-- Pré-contrôle IA (section 8, S10) : file pgmq, quota par entreprise, verdict écrit par le
-- serveur seul. Le téléphone ne peut ni écrire un verdict, ni marquer une preuve « conforme ».

create extension if not exists pgmq;
select pgmq.create('photo_analysis');

-- Quota journalier d'analyses IA par entreprise (section 8, « Maîtrise des coûts »).
alter table public.companies
  add column ai_daily_quota integer not null default 200 check (ai_daily_quota >= 0);

-- « Garder quand même » après une alerte orange : noté à part, jamais dans le verdict.
alter table public.photos add column ai_kept_at timestamptz;

create table public.ai_usage (
  company_id uuid not null references public.companies (id),
  day date not null,
  calls integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  -- Alerte interne : première fois du jour où le quota a été atteint.
  quota_reached_at timestamptz,
  primary key (company_id, day)
);
alter table public.ai_usage enable row level security;
-- Lecture par l'admin et le dirigeant ; aucune écriture côté client : seul le serveur compte.
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));
create trigger a_set_company_id before insert or update on public.ai_usage
  for each row execute function app.set_company_id();

-- Verdict IA : réservé au serveur (auth.uid() nul pour la clé de service).
create function app.photos_ai_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ai_status := 'pending';
    new.ai_result := null;
  elsif (new.ai_status, new.ai_result) is distinct from (old.ai_status, old.ai_result) then
    raise exception 'Le verdict IA est écrit par le serveur uniquement' using errcode = '42501';
  elsif old.ai_kept_at is not null and new.ai_kept_at is distinct from old.ai_kept_at then
    raise exception '« Garder quand même » ne s''annule pas' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger e_photos_ai_guard before insert or update on public.photos
  for each row execute function app.photos_ai_guard();

-- Une photo libre n'est pas analysée une à une (classement groupé plus tard).
create function app.photos_ai_skip_free() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.upload_status = 'verified' and old.upload_status is distinct from 'verified'
     and new.proof_slot_id is null then
    new.ai_status := 'skipped';
  end if;
  return new;
end $$;
create trigger f_photos_ai_skip_free before update on public.photos
  for each row execute function app.photos_ai_skip_free();

-- Empreinte vérifiée (S7) : la photo de preuve entre dans la file, la preuve passe « en analyse ».
create function app.photos_enqueue_analysis() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.upload_status = 'verified' and old.upload_status is distinct from 'verified'
     and new.proof_slot_id is not null and new.deleted_at is null then
    perform pgmq.send('photo_analysis', jsonb_build_object('photo_id', new.id));
    update public.proof_slots set status = 'analyzing'
      where id = new.proof_slot_id and company_id = new.company_id and status = 'captured';
  end if;
  return null;
end $$;
create trigger z_photos_enqueue_analysis after update on public.photos
  for each row execute function app.photos_enqueue_analysis();

-- Accès de la fonction analyze-photos (clé de service) à la file et au quota.
create function public.ai_queue_read(batch integer, visibility_s integer)
returns table (msg_id bigint, read_ct integer, photo_id uuid)
language sql security definer set search_path = '' as $$
  select r.msg_id, r.read_ct, (r.message ->> 'photo_id')::uuid
  from pgmq.read('photo_analysis', visibility_s, batch) r
$$;

create function public.ai_queue_delete(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.delete('photo_analysis', id)
$$;

create function public.ai_queue_archive(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.archive('photo_analysis', id)
$$;

-- Repousse un message (quota atteint : jusqu'au lendemain).
create function public.ai_queue_delay(id bigint, seconds integer) returns void
language sql security definer set search_path = '' as $$
  select pgmq.set_vt('photo_analysis', id, seconds)
$$;

/** Réserve une analyse pour l'entreprise aujourd'hui (heure de Paris) ; faux si quota atteint. */
create function public.ai_quota_take(p_company uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Europe/Paris')::date;
  v_ok boolean;
begin
  insert into public.ai_usage (company_id, day) values (p_company, v_day)
    on conflict (company_id, day) do nothing;
  update public.ai_usage u set calls = u.calls + 1
    from public.companies c
    where u.company_id = p_company and u.day = v_day and c.id = p_company
      and u.calls < c.ai_daily_quota
    returning true into v_ok;
  if v_ok then
    return true;
  end if;
  update public.ai_usage set quota_reached_at = coalesce(quota_reached_at, now())
    where company_id = p_company and day = v_day;
  return false;
end $$;

create function public.ai_usage_add_tokens(p_company uuid, p_input integer, p_output integer)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage set input_tokens = input_tokens + p_input, output_tokens = output_tokens + p_output
  where company_id = p_company and day = (now() at time zone 'Europe/Paris')::date
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'ai_queue_read(integer, integer)', 'ai_queue_delete(bigint)', 'ai_queue_archive(bigint)',
    'ai_queue_delay(bigint, integer)', 'ai_quota_take(uuid)', 'ai_usage_add_tokens(uuid, integer, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Traitement de la file chaque minute, seulement s'il y a des photos à analyser.
-- Prérequis (une fois, dans l'éditeur SQL du projet, jamais dans le code) :
--   select vault.create_secret('https://<projet>.supabase.co', 'project_url');
--   select vault.create_secret('<clé service_role>', 'service_role_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('analyze-photos', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/analyze-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from pgmq.q_photo_analysis)
$cron$);
