-- Tableau de bord du bureau (sections 10 et 14, S12) : demandes de reprise synchronisées vers
-- le poseur et closes par sa nouvelle photo, notifications push (jetons des téléphones).

-- Demandes de reprise : suivies par le téléphone (curseur de synchronisation).
alter table public.photo_requests add column updated_at timestamptz not null default now();
create trigger set_updated_at before update on public.photo_requests
  for each row execute function app.set_updated_at();

-- La nouvelle photo de la preuve clôt la demande de reprise.
create function app.photos_close_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.proof_slot_id is not null then
    update public.photo_requests set status = 'done', resolved_at = now()
      where proof_slot_id = new.proof_slot_id and company_id = new.company_id and status = 'open';
  end if;
  return null;
end $$;
create trigger z_photos_close_requests after insert on public.photos
  for each row execute function app.photos_close_requests();

-- Jetons push des téléphones (Expo). Chacun gère les siens.
create table public.push_tokens (
  token text primary key,
  company_id uuid not null references public.companies (id),
  profile_id uuid not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, company_id) references public.profiles (id, company_id)
);
alter table public.push_tokens enable row level security;
create policy push_tokens_select on public.push_tokens for select to authenticated
  using (profile_id = (select auth.uid()));
create policy push_tokens_insert on public.push_tokens for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy push_tokens_update on public.push_tokens for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy push_tokens_delete on public.push_tokens for delete to authenticated
  using (profile_id = (select auth.uid()));
create trigger a_set_company_id before insert or update on public.push_tokens
  for each row execute function app.set_company_id();
create trigger set_updated_at before update on public.push_tokens
  for each row execute function app.set_updated_at();

-- Notifications : créées par le serveur, envoyées par send-push (heures calmes respectées).
alter table public.notifications
  add column sent_at timestamptz,
  add column delivery text check (delivery in ('push', 'no_device', 'failed'));

-- Demande de reprise → notification au poseur, qui ouvre la caméra sur la bonne consigne.
create function app.photo_requests_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_instruction text;
begin
  select instruction into v_instruction from public.proof_slots
    where id = new.proof_slot_id and company_id = new.company_id;
  insert into public.notifications (company_id, recipient_id, kind, payload)
  values (new.company_id, new.recipient_id, 'photo_request', jsonb_build_object(
    'title', 'Photo à reprendre',
    'body', coalesce(new.message, v_instruction, 'Photo à reprendre'),
    'jobsite_id', new.jobsite_id,
    'proof_slot_id', new.proof_slot_id,
    'request_id', new.id));
  return null;
end $$;
create trigger z_photo_requests_notify after insert on public.photo_requests
  for each row execute function app.photo_requests_notify();

-- Envoi chaque minute s'il reste des notifications récentes à envoyer.
select cron.schedule('send-push', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notifications where sent_at is null and created_at > now() - interval '1 day')
$cron$);
