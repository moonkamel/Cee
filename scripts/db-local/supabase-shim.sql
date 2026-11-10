-- Imitation minimale de Supabase pour tester les migrations sur un Postgres nu,
-- quand `supabase start` n'est pas disponible (pas de Docker). Ne sert qu'aux tests locaux :
-- la CI exécute les mêmes tests sur le vrai Supabase.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create schema auth;
create schema storage;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- Privilèges par défaut de Supabase sur public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  phone text unique,
  encrypted_password varchar(255),
  phone_confirmed_at timestamptz,
  email_confirmed_at timestamptz,
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_token_current varchar(255),
  phone_change text,
  phone_change_token varchar(255),
  reauthentication_token varchar(255),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create table auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id),
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  id uuid primary key default gen_random_uuid()
);

create function auth.uid() returns uuid language sql stable as $$
  -- Même forme que Supabase : un réglage vide vaut absent.
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  metadata jsonb
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;

create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;

-- pgmq, pg_cron, pg_net et vault (S10) : imitations minimales, sans extension.
-- Les lignes « create extension if not exists pgmq|pg_cron|pg_net » des migrations sont
-- retirées par run-tests.sh ; le vrai comportement est testé en CI (supabase test db).
create schema pgmq;
create type pgmq.message_record as (msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb);
create function pgmq.create(queue_name text) returns void language plpgsql as $$
begin
  execute format('create table pgmq.%I (msg_id bigserial primary key, read_ct integer not null default 0,
    enqueued_at timestamptz not null default now(), vt timestamptz not null default now(), message jsonb)', 'q_' || queue_name);
  execute format('create table pgmq.%I (like pgmq.%I)', 'a_' || queue_name, 'q_' || queue_name);
end $$;
create function pgmq.send(queue_name text, msg jsonb) returns setof bigint language plpgsql as $$
begin
  return query execute format('insert into pgmq.%I (message) values ($1) returning msg_id', 'q_' || queue_name) using msg;
end $$;
create function pgmq.read(queue_name text, vt integer, qty integer) returns setof pgmq.message_record language plpgsql as $$
begin
  return query execute format(
    'update pgmq.%1$I set read_ct = read_ct + 1, vt = now() + make_interval(secs => $1)
     where msg_id in (select msg_id from pgmq.%1$I where vt <= now() order by msg_id limit $2 for update skip locked)
     returning msg_id, read_ct, enqueued_at, vt, message', 'q_' || queue_name) using vt, qty;
end $$;
create function pgmq.delete(queue_name text, msg_id bigint) returns boolean language plpgsql as $$
begin
  execute format('delete from pgmq.%I where msg_id = $1', 'q_' || queue_name) using msg_id;
  return found;
end $$;
create function pgmq.archive(queue_name text, msg_id bigint) returns boolean language plpgsql as $$
begin
  execute format('with m as (delete from pgmq.%I where msg_id = $1 returning *) insert into pgmq.%I select * from m',
    'q_' || queue_name, 'a_' || queue_name) using msg_id;
  return found;
end $$;
create function pgmq.set_vt(queue_name text, msg_id bigint, vt integer) returns setof pgmq.message_record language plpgsql as $$
begin
  return query execute format('update pgmq.%I set vt = now() + make_interval(secs => $2) where msg_id = $1
    returning msg_id, read_ct, enqueued_at, vt, message', 'q_' || queue_name) using msg_id, vt;
end $$;

create schema cron;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job values (job_name, schedule, command) on conflict (jobname) do update set command = excluded.command;
  select 1::bigint;
$$;
create schema net;
create function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}') returns bigint
  language sql as $$ select 1::bigint $$;
create schema vault;
create view vault.decrypted_secrets as select null::text as name, null::text as decrypted_secret where false;
