-- Lots CEE et alertes (section 10, S15) : niveau d'alerte des lots, reprise après contrôle,
-- alertes du tableau de la section 10, préférences et canal e-mail facultatif.

-- Préférences d'alertes et adresse e-mail facultative (« aucune adresse exigée », section 14) --
alter table public.profiles
  add column email text check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  add column muted_alerts text[] not null default '{}';

-- Canal de chaque notification : push, e-mail, ou les deux -------------------------------------
alter table public.notifications
  add column channel text not null default 'push' check (channel in ('push', 'email', 'push_email')),
  add column email_sent_at timestamptz,
  add column email_delivery text check (email_delivery in ('email', 'no_email', 'failed'));

alter table public.cee_batches
  add column alert_level text not null default 'normal' check (alert_level in ('normal', 'near', 'over'));
alter table public.inspections add column correction_planned_at timestamptz;

-- Envoi d'une alerte : préférences du destinataire respectées, sauf les alertes critiques pour
-- le dirigeant ; sans adresse e-mail, l'alerte part en notification.
create function app.notify(p_company uuid, p_recipient uuid, p_kind text, p_payload jsonb,
                           p_channel text, p_critical boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_email text;
  v_muted text[];
begin
  select role, email, muted_alerts into v_role, v_email, v_muted
  from public.profiles where id = p_recipient and company_id = p_company and active;
  if not found then
    return;
  end if;
  if p_kind = any (v_muted) and not (p_critical and v_role = 'owner') then
    return;
  end if;
  insert into public.notifications (company_id, recipient_id, kind, payload, channel)
  values (p_company, p_recipient, p_kind, p_payload,
          case when p_channel <> 'push' and v_email is null then 'push' else p_channel end);
end $$;

-- Dirigeants actifs d'une entreprise ; chefs d'équipe des poseurs d'un chantier.
create function app.owners_of(p_company uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles where company_id = p_company and role = 'owner' and active
$$;
create function app.leads_of(p_jobsite uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct l.id
  from public.jobsite_assignees a
  join public.profiles p on p.id = a.profile_id
  join public.profiles l on l.company_id = p.company_id and l.role = 'lead' and l.active
    and (l.id = p.id or (p.team_id is not null and l.team_id = p.team_id))
  where a.jobsite_id = p_jobsite
$$;

-- 1. Chantier terminé avec des preuves manquantes → chef d'équipe et dirigeant -----------------
create function app.jobsites_alert_incomplete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_missing integer;
  v_to uuid;
begin
  if new.status = 'completed_by_installer' and old.status is distinct from 'completed_by_installer' then
    select count(*) into v_missing from public.proof_slots
    where jobsite_id = new.id and applicable and required and status in ('missing', 'to_retake');
    if v_missing > 0 then
      for v_to in select app.owners_of(new.company_id) union select app.leads_of(new.id) loop
        perform app.notify(new.company_id, v_to, 'jobsite_incomplete', jsonb_build_object(
          'title', 'Chantier terminé incomplet',
          'body', coalesce(new.reference, new.address) || ' : ' || v_missing || ' preuve(s) manquante(s)',
          'jobsite_id', new.id), 'push', false);
      end loop;
    end if;
  end if;
  return null;
end $$;
create trigger z_jobsites_alert_incomplete after update on public.jobsites
  for each row execute function app.jobsites_alert_incomplete();

-- 2. Niveau d'alerte d'un lot ; le dirigeant n'est prévenu que si la situation s'aggrave -----
create function app.refresh_batch_level(p_batch uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_batch public.cee_batches;
  v_done integer;
  v_failed integer;
  v_threshold numeric;
  v_rate numeric;
  v_level text := 'normal';
  v_to uuid;
begin
  select * into v_batch from public.cee_batches where id = p_batch;
  if not found then
    return null;
  end if;
  select count(*), count(*) filter (where result = 'unsatisfactory') into v_done, v_failed
  from public.inspections where batch_id = p_batch;
  -- Seuil de l'année en cours, sinon le dernier connu : jamais codé en dur (section 10).
  select max_nonconformity_rate into v_threshold from public.cee_thresholds
  where year <= extract(year from now()) order by year desc limit 1;
  if v_done > 0 and v_threshold is not null then
    v_rate := v_failed::numeric / v_done;
    v_level := case when v_rate > v_threshold then 'over'
                    when v_rate > v_threshold - 0.02 then 'near' else 'normal' end;
  end if;
  if array_position(array['normal', 'near', 'over'], v_level)
     > array_position(array['normal', 'near', 'over'], v_batch.alert_level) then
    for v_to in select app.owners_of(v_batch.company_id) loop
      perform app.notify(v_batch.company_id, v_to, 'batch_threshold', jsonb_build_object(
        'title', case v_level when 'over' then 'Lot au-dessus du seuil' else 'Lot proche du seuil' end,
        'body', v_batch.operation_code || ' : ' || round(v_rate * 100, 1) || ' % de non-conformité (seuil '
                || round(v_threshold * 100, 1) || ' %)',
        'batch_id', p_batch), 'push_email', true);
    end loop;
  end if;
  update public.cee_batches set alert_level = v_level where id = p_batch and alert_level <> v_level;
  return v_level;
end $$;

-- 3. Contrôle enregistré : non satisfaisant → dirigeant et chef d'équipe ; niveau du lot ------
create function app.inspections_alert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ref text;
  v_to uuid;
begin
  if new.result = 'unsatisfactory' and (tg_op = 'INSERT' or old.result is distinct from 'unsatisfactory') then
    select coalesce(reference, address) into v_ref from public.jobsites where id = new.jobsite_id;
    for v_to in select app.owners_of(new.company_id) union select app.leads_of(new.jobsite_id) loop
      perform app.notify(new.company_id, v_to, 'inspection_failed', jsonb_build_object(
        'title', 'Contrôle non satisfaisant',
        'body', v_ref || coalesce(' : ' || left(new.findings, 120), ''),
        'jobsite_id', new.jobsite_id), 'push', true);
    end loop;
  end if;
  if new.batch_id is not null then
    perform app.refresh_batch_level(new.batch_id);
  end if;
  if tg_op = 'UPDATE' and old.batch_id is not null and old.batch_id is distinct from new.batch_id then
    perform app.refresh_batch_level(old.batch_id);
  end if;
  return null;
end $$;
create trigger z_inspections_alert after insert or update on public.inspections
  for each row execute function app.inspections_alert();

-- 4. « Planifier la reprise » : nouvelles preuves « après correction », chantier en cours -----
create function public.plan_correction(p_inspection uuid, p_slot_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_insp public.inspections;
  v_slot public.proof_slots;
  v_base text;
  v_n integer;
  v_pos integer;
  v_count integer := 0;
  v_to uuid;
begin
  if auth.uid() is null or not app.has_role('office', 'admin', 'owner') then
    raise exception 'Reprise planifiée par le bureau ou le dirigeant' using errcode = '42501';
  end if;
  select * into v_insp from public.inspections
  where id = p_inspection and company_id = app.current_company_id();
  if not found or v_insp.result <> 'unsatisfactory' or v_insp.corrected_on is not null then
    raise exception 'Contrôle introuvable, satisfaisant ou déjà corrigé' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_slot_ids), 0) = 0 then
    raise exception 'Choisissez au moins une preuve à refaire' using errcode = 'P0001';
  end if;
  select coalesce(max(position), 0) into v_pos from public.proof_slots where jobsite_id = v_insp.jobsite_id;
  for v_slot in
    select * from public.proof_slots where id = any (p_slot_ids) and jobsite_id = v_insp.jobsite_id order by position
  loop
    v_base := split_part(v_slot.item_key, '~reprise-', 1);
    select coalesce(max(nullif(split_part(item_key, '~reprise-', 2), '')::integer), 0) + 1 into v_n
    from public.proof_slots where operation_id = v_slot.operation_id and split_part(item_key, '~reprise-', 1) = v_base;
    v_pos := v_pos + 1;
    insert into public.proof_slots (company_id, jobsite_id, operation_id, item_key, instruction, phase, position,
                                    required, min_photos, status)
    values (v_slot.company_id, v_slot.jobsite_id, v_slot.operation_id, v_base || '~reprise-' || v_n,
            regexp_replace(v_slot.instruction, ' \(après correction\)$', '') || ' (après correction)',
            'apres', v_pos, true, 1, 'missing');
    v_count := v_count + 1;
  end loop;
  if v_count <> cardinality(p_slot_ids) then
    raise exception 'Preuve inconnue sur ce chantier' using errcode = 'P0001';
  end if;
  update public.jobsites set status = 'in_progress' where id = v_insp.jobsite_id;
  update public.inspections set correction_planned_at = now() where id = p_inspection;
  for v_to in select profile_id from public.jobsite_assignees where jobsite_id = v_insp.jobsite_id loop
    perform app.notify(v_insp.company_id, v_to, 'correction_planned', jsonb_build_object(
      'title', 'Reprise à faire', 'body', v_count || ' photo(s) après correction',
      'jobsite_id', v_insp.jobsite_id), 'push', false);
  end loop;
  return v_count;
end $$;
revoke all on function public.plan_correction(uuid, uuid[]) from public, anon;
grant execute on function public.plan_correction(uuid, uuid[]) to authenticated;

-- 5. Récapitulatif du matin : photos orange depuis 48 h (bureau), RGE expirant sous 60 jours ---
create function app.daily_alerts(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (p_now at time zone 'Europe/Paris')::date;
  v_count integer := 0;
  r record;
  v_to uuid;
  q jsonb;
begin
  if extract(hour from p_now at time zone 'Europe/Paris') <> 8 then
    return 0;
  end if;
  for r in
    select s.company_id, count(*) as n,
           string_agg(distinct coalesce(j.reference, j.address), ', ') as refs
    from public.proof_slots s join public.jobsites j on j.id = s.jobsite_id
    where s.status = 'to_retake' and s.applicable and s.updated_at < p_now - interval '48 hours'
    group by s.company_id
  loop
    for v_to in
      select id from public.profiles where company_id = r.company_id and active and role = 'office'
      union
      -- Sans bureau, le récapitulatif va à l'admin et au dirigeant.
      select id from public.profiles where company_id = r.company_id and active and role in ('admin', 'owner')
        and not exists (select 1 from public.profiles o where o.company_id = r.company_id and o.role = 'office' and o.active)
    loop
      perform app.notify(r.company_id, v_to, 'orange_overdue', jsonb_build_object(
        'title', 'Photos à trancher', 'body', r.n || ' photo(s) orange depuis plus de 48 h : ' || left(r.refs, 300)),
        'email', false);
      v_count := v_count + 1;
    end loop;
  end loop;
  for r in select id, rge_qualifications from public.companies loop
    for q in select * from jsonb_array_elements(r.rge_qualifications) loop
      if (q ->> 'date_fin') ~ '^\d{4}-\d{2}-\d{2}$'
         and (q ->> 'date_fin')::date between v_today and v_today + 60
         and not exists (select 1 from public.notifications n where n.company_id = r.id and n.kind = 'rge_expiring'
                         and n.payload ->> 'numero' is not distinct from q ->> 'numero'
                         and n.payload ->> 'date_fin' = q ->> 'date_fin') then
        for v_to in select app.owners_of(r.id) loop
          perform app.notify(r.id, v_to, 'rge_expiring', jsonb_build_object(
            'title', 'Qualification RGE bientôt expirée',
            'body', coalesce(q ->> 'organisme', 'RGE') || ' ' || coalesce(q ->> 'numero', '')
                    || ' : fin le ' || to_char((q ->> 'date_fin')::date, 'DD/MM/YYYY'),
            'numero', q ->> 'numero', 'date_fin', q ->> 'date_fin'), 'email', false);
          v_count := v_count + 1;
        end loop;
      end if;
    end loop;
  end loop;
  return v_count;
end $$;
revoke all on function app.daily_alerts(timestamptz) from public, anon, authenticated;

-- Tâches planifiées ---------------------------------------------------------------------------
-- 8 h à Paris : pg_cron tourne en UTC, la fonction garde la bonne heure (hiver et été).
select cron.schedule('daily-alerts', '0 6,7 * * *', $cron$ select app.daily_alerts() $cron$);
-- Le push ignore les alertes envoyées par e-mail seulement.
select cron.schedule('send-push', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notifications
                where sent_at is null and channel <> 'email' and created_at > now() - interval '1 day')
$cron$);
select cron.schedule('send-emails', '*/5 * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notifications
                where email_sent_at is null and channel <> 'push' and created_at > now() - interval '1 day')
$cron$);
