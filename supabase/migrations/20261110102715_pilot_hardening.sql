-- Finitions avant pilote (sections 16 et 17, S19) : plafond de SMS, durée de conservation,
-- effacement des données d'un client.

-- SMS : coût direct, donc plafond par entreprise et par jour (invitations, liens client, codes).
create table public.sms_usage (
  company_id uuid not null references public.companies (id),
  day date not null,
  sent integer not null default 0,
  limit_reached_at timestamptz,
  primary key (company_id, day)
);
alter table public.sms_usage enable row level security;
create trigger a_set_company_id before insert or update on public.sms_usage
  for each row execute function app.set_company_id();
create policy sms_usage_select on public.sms_usage for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));

alter table public.companies
  add column sms_daily_limit integer not null default 60 check (sms_daily_limit between 0 and 1000),
  -- Conservation des chantiers et photos (section 16) : 10 ans, alignés sur la décennale.
  add column retention_years integer not null default 10 check (retention_years between 5 and 30);

create function public.sms_quota_take(p_company uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Europe/Paris')::date;
  v_ok boolean;
begin
  insert into public.sms_usage (company_id, day) values (p_company, v_day)
    on conflict (company_id, day) do nothing;
  update public.sms_usage u set sent = u.sent + 1
    from public.companies c
    where u.company_id = p_company and u.day = v_day and c.id = p_company
      and u.sent < c.sms_daily_limit
    returning true into v_ok;
  if v_ok then
    return true;
  end if;
  update public.sms_usage set limit_reached_at = coalesce(limit_reached_at, now())
    where company_id = p_company and day = v_day;
  return false;
end $$;
revoke all on function public.sms_quota_take(uuid) from public, anon, authenticated;
grant execute on function public.sms_quota_take(uuid) to service_role;

-- L'offre (plafond SMS) n'est pas réglable par l'entreprise elle-même.
create or replace function app.companies_billing_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
     and (new.plan, new.trial_ends_at, new.stripe_customer_id, new.sms_daily_limit)
         is distinct from (old.plan, old.trial_ends_at, old.stripe_customer_id, old.sms_daily_limit) then
    raise exception 'Offre gérée par l''abonnement' using errcode = '42501';
  end if;
  return new;
end $$;

-- Droit à l'effacement d'un client (section 16), traité par le bureau de l'entreprise.
-- Sans chantier : nom, coordonnées et adresse sont effacés. Avec un chantier : la preuve des
-- travaux est conservée (nom et adresse du chantier, PV), mais le téléphone et l'e-mail sont
-- effacés, ses liens personnels révoqués, et la fiche marquée « accès restreint ».
alter table public.clients add column erased_at timestamptz;

-- Le journal d'audit reste en ajout seul, à une exception : l'effacement d'un client y masque
-- ses données personnelles (et seulement elles), sans supprimer de ligne.
create function app.redact(p_diff jsonb, p_keys text[]) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k,
    case
      when not (k = any (p_keys)) then v
      when jsonb_typeof(v) = 'object' and v ? 'old'
        then jsonb_build_object('old', case when v -> 'old' = 'null' then 'null'::jsonb else '"[effacé]"'::jsonb end,
                                'new', case when v -> 'new' = 'null' then 'null'::jsonb else '"[effacé]"'::jsonb end)
      when v = 'null' then v
      else '"[effacé]"'::jsonb
    end), '{}'::jsonb)
  from jsonb_each(p_diff) as e(k, v)
$$;

create function app.audit_log_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('app.erasure', true), '') = 'on'
     and (to_jsonb(new) - 'diff') = (to_jsonb(old) - 'diff') then
    return new;
  end if;
  raise exception 'Le journal d''audit ne se modifie pas' using errcode = 'P0001';
end $$;
drop trigger no_change on public.audit_log;
create trigger no_change before update or delete on public.audit_log
  for each row execute function app.audit_log_guard();

create function public.erase_client(p_client uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_client public.clients;
  v_kept boolean;
begin
  select * into v_client from public.clients
  where id = p_client and company_id = app.current_company_id();
  if v_client.id is null or not app.has_role('admin', 'owner') then
    raise exception 'Réservé à l''admin et au dirigeant' using errcode = '42501';
  end if;
  v_kept := exists (select 1 from public.jobsites where client_id = p_client);
  perform set_config('app.erasure', 'on', true);
  update public.share_links set revoked_at = coalesce(revoked_at, now())
  where jobsite_id in (select id from public.jobsites where client_id = p_client);
  if v_kept then
    update public.clients set phone = null, email = null, marketing_consent = false, erased_at = now()
    where id = p_client;
    update public.audit_log set diff = app.redact(diff, array['phone', 'email'])
    where table_name = 'clients' and record_id = p_client::text;
    perform set_config('app.erasure', 'off', true);
    return 'restreint';
  end if;
  update public.clients
  set full_name = 'Client effacé', phone = null, email = null, address = null, ban_id = null,
      lat = null, lng = null, marketing_consent = false, erased_at = now()
  where id = p_client;
  update public.audit_log
  set diff = app.redact(diff, array['full_name', 'phone', 'email', 'address', 'ban_id', 'lat', 'lng'])
  where table_name = 'clients' and record_id = p_client::text;
  perform set_config('app.erasure', 'off', true);
  return 'efface';
end $$;
revoke all on function public.erase_client(uuid) from public, anon;
grant execute on function public.erase_client(uuid) to authenticated;

-- Santé du service (section 17) : messages en attente et âge du plus ancien, par file.
-- Lue par l'Edge Function « health » qu'interroge la supervision externe.
create function public.queue_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_out jsonb := '{}';
  v_name text;
  v_waiting integer;
  v_oldest double precision;
begin
  foreach v_name in array array['photo_analysis', 'voice_transcription', 'report_generation', 'marketing_generation'] loop
    execute format('select count(*), extract(epoch from now() - min(enqueued_at)) from pgmq.%I', 'q_' || v_name)
      into v_waiting, v_oldest;
    v_out := v_out || jsonb_build_object(v_name, jsonb_build_object('waiting', v_waiting, 'oldest_s', round(v_oldest::numeric)));
  end loop;
  return v_out;
end $$;
revoke all on function public.queue_health() from public, anon, authenticated;
grant execute on function public.queue_health() to service_role;

-- Copies montrées au client (section 16) : la page reçoit les visages et plaques repérés par
-- le pré-contrôle IA, et sert une copie floutée de ces photos.
create or replace function public.client_portal(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  v_out jsonb;
begin
  v_link := app.valid_link(p_token);
  if v_link.id is null then
    return null;
  end if;
  update public.share_links set last_seen_at = now() where id = v_link.id;
  select jsonb_build_object(
    'link', jsonb_build_object('id', v_link.id, 'require_sms', v_link.require_sms, 'expires_at', v_link.expires_at,
                               'purpose', v_link.purpose),
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'logo_path', c.logo_path,
                                  'brand_color', c.brand_color, 'google_review_url', c.google_review_url,
                                  'rge', c.rge_qualifications),
    'jobsite', jsonb_build_object('id', j.id, 'reference', j.reference, 'address', j.address,
                                  'planned_start', j.planned_start, 'planned_end', j.planned_end,
                                  'client_name', cl.full_name, 'has_phone', cl.phone is not null,
                                  'has_email', cl.email is not null,
                                  'operations', coalesce((select jsonb_agg(o.label order by o.created_at)
                                                          from public.jobsite_operations o where o.jobsite_id = j.id), '[]')),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'phase', coalesce(s.phase, 'divers'), 'label', coalesce(s.instruction, p.caption, ''),
               'taken_at', p.device_taken_at, 'thumbnail_path', p.thumbnail_path, 'original_path', p.original_path,
               'extracted', p.ai_result -> 'verdict' -> 'extracted',
               'privacy', coalesce(p.ai_result -> 'verdict' -> 'privacy_regions', '[]'))
             order by p.device_taken_at)
      from public.photos p left join public.proof_slots s on s.id = p.proof_slot_id
      where p.jobsite_id = j.id and p.deleted_at is null and p.source = 'camera' and p.upload_status <> 'pending'
        and ((p.proof_slot_id is not null and s.applicable and not p.client_hidden)
             or (p.proof_slot_id is null and p.client_visible))), '[]'),
    'report', (
      select jsonb_build_object('pdf_path', r.pdf_path, 'content', r.content)
      from public.reports r
      where r.jobsite_id = j.id and r.kind = 'completion'
      order by (r.pdf_path is not null) desc, r.created_at desc, r.version desc limit 1),
    'signature', (
      select jsonb_build_object('id', g.id, 'signed_at', g.signed_at, 'signer_name', g.signer_name,
                                'has_reserves', g.has_reserves, 'reserves', g.reserves, 'pdf_path', g.pdf_path)
      from public.signatures g where g.jobsite_id = j.id order by g.signed_at desc limit 1)
  ) into v_out
  from public.jobsites j
  join public.companies c on c.id = j.company_id
  left join public.clients cl on cl.id = j.client_id
  where j.id = v_link.jobsite_id;
  return v_out;
end $$;

-- Chantier de démonstration : la date de réception d'une photo est figée ; la finalisation ne
-- la touche plus (elle échouait hors de la transaction de création).
create or replace function public.finish_demo_jobsite(p_jobsite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_saved text[];
begin
  if not exists (select 1 from public.jobsites
                 where id = p_jobsite and is_demo and company_id = app.current_company_id())
     or not app.has_role('admin', 'owner') then
    raise exception 'Chantier de démonstration introuvable' using errcode = '42501';
  end if;
  v_saved := app.act_as_server();
  update public.photos set upload_status = 'verified', ai_status = 'done'
  where jobsite_id = p_jobsite and upload_status <> 'verified';
  update public.proof_slots s set status = 'compliant'
  where s.jobsite_id = p_jobsite and s.status in ('missing', 'captured', 'analyzing')
    and exists (select 1 from public.photos p where p.proof_slot_id = s.id and p.deleted_at is null);
  perform app.act_as_user(v_saved);
end $$;
