-- Rapports PDF (section 9, S13) : rédigés par l'IA côté serveur (Edge Function write-reports),
-- relus et modifiés par le bureau, composés en PDF par le web. Chaque version est conservée :
-- une modification crée la version suivante de la même série, jamais une réécriture.

alter table public.reports
  add column series_id uuid not null default gen_random_uuid(),
  add column period date, -- jour couvert par un compte rendu du jour
  add column pdf_sha256 public.sha256_hex,
  add column pdf_created_at timestamptz,
  add constraint reports_id_company_key unique (id, company_id),
  add constraint reports_series_version_key unique (series_id, version),
  add constraint reports_pdf_pair check ((pdf_path is null) = (pdf_sha256 is null));
create index on public.reports (series_id);

-- Le bureau crée la version suivante d'une série existante ; le PDF est attaché une seule fois ;
-- rien d'autre ne change. Le serveur (auth.uid() nul) ouvre les séries.
create function app.reports_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_last public.reports;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      return new;
    end if;
    select * into v_last from public.reports
      where series_id = new.series_id order by version desc limit 1;
    if v_last.id is null then
      raise exception 'Un rapport est rédigé par le serveur ; le bureau en crée une nouvelle version'
        using errcode = '42501';
    end if;
    if new.version <> v_last.version + 1 or new.jobsite_id <> v_last.jobsite_id
       or new.kind <> v_last.kind or new.period is distinct from v_last.period then
      raise exception 'Nouvelle version : même série, numéro suivant' using errcode = 'P0001';
    end if;
    new.pdf_path := null;
    new.pdf_sha256 := null;
    new.pdf_created_at := null;
    return new;
  end if;
  if (new.id, new.company_id, new.jobsite_id, new.kind, new.version, new.content, new.series_id,
      new.period, new.created_by, new.created_at)
     is distinct from
     (old.id, old.company_id, old.jobsite_id, old.kind, old.version, old.content, old.series_id,
      old.period, old.created_by, old.created_at) then
    raise exception 'Une version de rapport ne change pas : créez la suivante' using errcode = 'P0001';
  end if;
  if old.pdf_path is not null
     and (new.pdf_path, new.pdf_sha256, new.pdf_created_at)
         is distinct from (old.pdf_path, old.pdf_sha256, old.pdf_created_at) then
    raise exception 'Le PDF d''une version est définitif' using errcode = 'P0001';
  end if;
  if new.pdf_path is not null and old.pdf_path is null then
    new.pdf_created_at := now();
  end if;
  return new;
end $$;
create trigger e_reports_guard before insert or update on public.reports
  for each row execute function app.reports_guard();
create trigger no_delete before delete on public.reports
  for each row execute function app.forbid_change();

-- File de rédaction ---------------------------------------------------------------------------
select pgmq.create('report_generation');

-- Fin de chantier : le poseur appuie sur « Terminer le chantier ».
create function app.jobsites_enqueue_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed_by_installer' and old.status is distinct from 'completed_by_installer' then
    perform pgmq.send('report_generation',
      jsonb_build_object('jobsite_id', new.id, 'kind', 'completion'));
  end if;
  return null;
end $$;
create trigger z_jobsites_enqueue_completion after update on public.jobsites
  for each row execute function app.jobsites_enqueue_completion();

-- Demande du bureau : rapport de fin de chantier à refaire, dossier de litige sur une sélection.
create function public.request_report(p_jobsite uuid, p_kind text, p_photo_ids uuid[] default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not app.has_role('lead', 'office', 'admin', 'owner')
     or not app.can_see_jobsite(p_jobsite) then
    raise exception 'Rapport réservé au chef, au bureau et au dirigeant' using errcode = '42501';
  end if;
  if p_kind = 'dispute' then
    if coalesce(cardinality(p_photo_ids), 0) = 0 then
      raise exception 'Dossier de litige : choisissez au moins une photo' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from unnest(p_photo_ids) as s(id)
      where not exists (select 1 from public.photos p
                        where p.id = s.id and p.jobsite_id = p_jobsite and p.deleted_at is null)
    ) then
      raise exception 'Photo inconnue sur ce chantier' using errcode = 'P0001';
    end if;
    perform pgmq.send('report_generation', jsonb_build_object(
      'jobsite_id', p_jobsite, 'kind', 'dispute', 'photo_ids', to_jsonb(p_photo_ids)));
  elsif p_kind = 'completion' then
    perform pgmq.send('report_generation',
      jsonb_build_object('jobsite_id', p_jobsite, 'kind', 'completion'));
  else
    raise exception 'Type de rapport inconnu : %', p_kind using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.request_report(uuid, text, uuid[]) from public, anon;
grant execute on function public.request_report(uuid, text, uuid[]) to authenticated;

-- Compte rendu du jour : à 18 h (heure de Paris), pour chaque chantier qui a eu de l'activité.
create function app.enqueue_daily_reports(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (p_now at time zone 'Europe/Paris')::date;
  v_count integer := 0;
  r record;
begin
  if extract(hour from p_now at time zone 'Europe/Paris') <> 18 then
    return 0;
  end if;
  for r in
    select j.id from public.jobsites j
    where (exists (select 1 from public.photos p where p.jobsite_id = j.id and p.deleted_at is null
                   and (p.device_taken_at at time zone 'Europe/Paris')::date = v_day)
           or exists (select 1 from public.voice_notes n where n.jobsite_id = j.id and n.deleted_at is null
                      and (n.created_at at time zone 'Europe/Paris')::date = v_day))
      and not exists (select 1 from public.reports x
                      where x.jobsite_id = j.id and x.kind = 'daily' and x.period = v_day)
  loop
    perform pgmq.send('report_generation',
      jsonb_build_object('jobsite_id', r.id, 'kind', 'daily', 'period', v_day));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function app.enqueue_daily_reports(timestamptz) from public, anon, authenticated;

create function public.report_queue_read(batch integer, visibility_s integer)
returns table (msg_id bigint, read_ct integer, message jsonb)
language sql security definer set search_path = '' as $$
  select r.msg_id, r.read_ct, r.message from pgmq.read('report_generation', visibility_s, batch) r
$$;
create function public.report_queue_delete(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.delete('report_generation', id)
$$;
create function public.report_queue_archive(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.archive('report_generation', id)
$$;
create function public.report_queue_delay(id bigint, seconds integer) returns void
language sql security definer set search_path = '' as $$
  select pgmq.set_vt('report_generation', id, seconds)
$$;
do $$
declare f text;
begin
  foreach f in array array[
    'report_queue_read(integer, integer)', 'report_queue_delete(bigint)',
    'report_queue_archive(bigint)', 'report_queue_delay(bigint, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Vérification publique (QR code du PDF) : le minimum pour comparer l'empreinte d'un document.
create function public.verify_report(p_id uuid)
returns table (reference text, company text, kind text, version integer,
               pdf_created_at timestamptz, pdf_sha256 text)
language sql stable security definer set search_path = '' as $$
  select j.reference, c.name, r.kind, r.version, r.pdf_created_at, r.pdf_sha256
  from public.reports r
  join public.jobsites j on j.id = r.jobsite_id
  join public.companies c on c.id = r.company_id
  where r.id = p_id and r.pdf_sha256 is not null
$$;
revoke all on function public.verify_report(uuid) from public;
grant execute on function public.verify_report(uuid) to anon, authenticated;

-- Tâches planifiées (mêmes secrets du coffre que l'analyse des photos).
select cron.schedule('daily-reports', '0 16,17 * * *', $cron$
  select app.enqueue_daily_reports()
$cron$);
select cron.schedule('write-reports', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/write-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from pgmq.q_report_generation)
$cron$);
