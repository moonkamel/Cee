-- Notes vocales (section 9, S11) : audio envoyé par le téléphone, transcrit puis nettoyé par
-- le serveur ; problèmes et matériel repérés pour le bureau. L'audio d'origine est conservé.

alter table public.voice_notes
  add column upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded')),
  add constraint voice_notes_id_company_key unique (id, company_id);

-- Transcription et statut : écrits par le serveur uniquement.
create function app.voice_notes_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.transcript := null;
    new.transcript_clean := null;
    new.status := 'pending';
  elsif (new.transcript, new.transcript_clean, new.status)
        is distinct from (old.transcript, old.transcript_clean, old.status) then
    raise exception 'La transcription est écrite par le serveur uniquement' using errcode = '42501';
  elsif old.upload_status = 'uploaded' and new.upload_status <> 'uploaded' then
    new.upload_status := 'uploaded';
  end if;
  return new;
end $$;
create trigger e_voice_notes_guard before insert or update on public.voice_notes
  for each row execute function app.voice_notes_guard();

-- Problèmes et matériel repérés dans une note (l'IA signale, le bureau décide).
create table public.note_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  voice_note_id uuid not null,
  kind text not null check (kind in ('problem', 'material')),
  summary text not null,
  quantity numeric,
  unit text,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (voice_note_id, company_id) references public.voice_notes (id, company_id)
);
create index on public.note_items (jobsite_id);
alter table public.note_items enable row level security;
create policy note_items_select on public.note_items for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
-- Aucune création côté client ; le bureau marque une alerte traitée ou du matériel commandé.
create policy note_items_update on public.note_items for update to authenticated
  using (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create trigger a_set_company_id before insert or update on public.note_items
  for each row execute function app.set_company_id();
create trigger c_freeze_note_items before update on public.note_items for each row
  execute function app.freeze_columns('jobsite_id', 'voice_note_id', 'kind', 'summary', 'quantity', 'unit', 'created_at');
create trigger no_delete before delete on public.note_items
  for each row execute function app.forbid_change();
-- Curseur de synchronisation du téléphone.
create trigger set_updated_at before update on public.note_items
  for each row execute function app.set_updated_at();

-- File de transcription : la note y entre quand son audio est arrivé.
select pgmq.create('voice_transcription');

create function app.voice_notes_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.upload_status = 'uploaded'
     and (tg_op = 'INSERT' or old.upload_status is distinct from 'uploaded')
     and new.deleted_at is null and new.status = 'pending' then
    perform pgmq.send('voice_transcription', jsonb_build_object('voice_note_id', new.id));
  end if;
  return null;
end $$;
create trigger z_voice_notes_enqueue after insert or update on public.voice_notes
  for each row execute function app.voice_notes_enqueue();

create function public.voice_queue_read(batch integer, visibility_s integer)
returns table (msg_id bigint, read_ct integer, voice_note_id uuid)
language sql security definer set search_path = '' as $$
  select r.msg_id, r.read_ct, (r.message ->> 'voice_note_id')::uuid
  from pgmq.read('voice_transcription', visibility_s, batch) r
$$;
create function public.voice_queue_delete(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.delete('voice_transcription', id)
$$;
create function public.voice_queue_archive(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.archive('voice_transcription', id)
$$;
create function public.voice_queue_delay(id bigint, seconds integer) returns void
language sql security definer set search_path = '' as $$
  select pgmq.set_vt('voice_transcription', id, seconds)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'voice_queue_read(integer, integer)', 'voice_queue_delete(bigint)',
    'voice_queue_archive(bigint)', 'voice_queue_delay(bigint, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Chaque minute, si des notes attendent (mêmes secrets du coffre que l'analyse des photos).
select cron.schedule('transcribe-notes', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/transcribe-notes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from pgmq.q_voice_transcription)
$cron$);
