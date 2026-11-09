-- Recyclage marketing des photos (section 13, S17).
-- Un chantier terminé, aux preuves exigées validées et dont le PV porte la case de consentement,
-- part dans la file « marketing_generation ». L'Edge Function marketing-candidates y choisit la
-- paire avant/après, les zones à flouter et trois légendes (IA), puis crée un contenu « À valider ».
-- Les visuels (carré, vertical) sont composés par le web à la première ouverture. Rien n'est
-- publié sans le dirigeant ou l'admin.

-- Ton des légendes par défaut de l'entreprise.
alter table public.companies
  add column marketing_tone text not null default 'sobre'
    check (marketing_tone in ('sobre', 'chaleureux', 'technique'));

alter table public.marketing_assets
  add column city text,
  add column captions jsonb not null default '{}' check (jsonb_typeof(captions) = 'object'),
  add column before_regions jsonb not null default '[]' check (jsonb_typeof(before_regions) = 'array'),
  add column after_regions jsonb not null default '[]' check (jsonb_typeof(after_regions) = 'array'),
  add column choice_reason text,
  add column ai_model text,
  add column updated_at timestamptz not null default now(),
  add constraint marketing_paths check (
    (square_path is null or square_path like company_id::text || '/marketing/%')
    and (story_path is null or story_path like company_id::text || '/marketing/%'));
-- Un contenu par chantier : ni doublon, ni nouvelle proposition après « Ignorer ».
create unique index marketing_assets_one_per_jobsite on public.marketing_assets (jobsite_id);
create index on public.marketing_assets (company_id, status, created_at desc);
create trigger set_updated_at before update on public.marketing_assets
  for each row execute function app.set_updated_at();

-- Ce que l'IA a proposé ne change pas ; seuls la légende retenue, son ton et la décision
-- (« Publier » ou « Ignorer », une seule fois) bougent, et les visuels sont attachés une fois.
create function app.marketing_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un contenu marketing ne se supprime pas' using errcode = 'P0001';
  end if;
  if (new.company_id, new.jobsite_id, new.before_photo_id, new.after_photo_id, new.captions,
      new.before_regions, new.after_regions, new.city, new.choice_reason, new.ai_model, new.created_at)
     is distinct from
     (old.company_id, old.jobsite_id, old.before_photo_id, old.after_photo_id, old.captions,
      old.before_regions, old.after_regions, old.city, old.choice_reason, old.ai_model, old.created_at) then
    raise exception 'La proposition de l''IA ne se modifie pas' using errcode = 'P0001';
  end if;
  if (old.square_path is not null and new.square_path is distinct from old.square_path)
     or (old.story_path is not null and new.story_path is distinct from old.story_path) then
    raise exception 'Visuel déjà composé' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'to_review' or new.status not in ('published', 'ignored') then
      raise exception 'Contenu déjà traité' using errcode = 'P0001';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  elsif (new.reviewed_by, new.reviewed_at) is distinct from (old.reviewed_by, old.reviewed_at) then
    raise exception 'Décision enregistrée par la base' using errcode = 'P0001';
  end if;
  if old.status <> 'to_review'
     and (new.generated_text, new.tone) is distinct from (old.generated_text, old.tone) then
    raise exception 'Contenu déjà traité' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger e_marketing_guard before update or delete on public.marketing_assets
  for each row execute function app.marketing_guard();

-- Chantier terminé et conforme, avec consentement, sans contenu déjà proposé
-- (même règle que marketingEligible, packages/shared/src/marketing).
create function app.marketing_eligible(p_jobsite uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobsites j where j.id = p_jobsite
                 and j.status in ('completed_by_installer', 'verified_by_office', 'exported', 'inspected'))
     and exists (select 1 from public.signatures s where s.jobsite_id = p_jobsite and s.marketing_consent)
     and not exists (select 1 from public.proof_slots ps
                     where ps.jobsite_id = p_jobsite and ps.applicable and ps.required
                       and ps.status not in ('compliant', 'manually_validated', 'waived'))
     and not exists (select 1 from public.marketing_assets m where m.jobsite_id = p_jobsite)
$$;

select pgmq.create('marketing_generation');

create function app.marketing_enqueue(p_jobsite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.marketing_eligible(p_jobsite)
     and not exists (select 1 from pgmq.q_marketing_generation q
                     where q.message ->> 'jobsite_id' = p_jobsite::text) then
    perform pgmq.send('marketing_generation', jsonb_build_object('jobsite_id', p_jobsite));
  end if;
end $$;

-- Déclencheurs : PV signé, chantier terminé, preuve validée (dans n'importe quel ordre).
create function app.marketing_on_signature() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.marketing_consent then
    perform app.marketing_enqueue(new.jobsite_id);
  end if;
  return null;
end $$;
create trigger z_marketing_on_signature after insert on public.signatures
  for each row execute function app.marketing_on_signature();

create function app.marketing_on_jobsite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform app.marketing_enqueue(new.id);
  end if;
  return null;
end $$;
create trigger z_marketing_on_jobsite after update of status on public.jobsites
  for each row execute function app.marketing_on_jobsite();

create function app.marketing_on_slot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.status, new.applicable, new.required) is distinct from (old.status, old.applicable, old.required) then
    perform app.marketing_enqueue(new.jobsite_id);
  end if;
  return null;
end $$;
create trigger z_marketing_on_slot after update of status, applicable, required on public.proof_slots
  for each row execute function app.marketing_on_slot();

-- Contenu prêt : dirigeants et admins prévenus (préférences d'alertes respectées).
create function app.marketing_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_to uuid;
  v_ref text;
begin
  select reference into v_ref from public.jobsites where id = new.jobsite_id;
  for v_to in
    select id from public.profiles
    where company_id = new.company_id and active and role in ('owner', 'admin')
  loop
    perform app.notify(new.company_id, v_to, 'marketing_ready',
      jsonb_build_object('title', 'Contenu à valider',
                         'body', coalesce(v_ref, 'Chantier') || ' : avant/après prêt à publier',
                         'jobsite_id', new.jobsite_id, 'marketing_id', new.id),
      'push', false);
  end loop;
  return null;
end $$;
create trigger z_marketing_notify after insert on public.marketing_assets
  for each row execute function app.marketing_notify();

-- File, côté serveur seulement --------------------------------------------------------------------
create function public.marketing_queue_read(batch integer, visibility_s integer)
returns table (msg_id bigint, read_ct integer, message jsonb)
language sql security definer set search_path = '' as $$
  select r.msg_id, r.read_ct, r.message from pgmq.read('marketing_generation', visibility_s, batch) r
$$;
create function public.marketing_queue_delete(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.delete('marketing_generation', id)
$$;
create function public.marketing_queue_archive(id bigint) returns void
language sql security definer set search_path = '' as $$
  select pgmq.archive('marketing_generation', id)
$$;
create function public.marketing_queue_delay(id bigint, seconds integer) returns void
language sql security definer set search_path = '' as $$
  select pgmq.set_vt('marketing_generation', id, seconds)
$$;
create function public.marketing_is_eligible(p_jobsite uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.marketing_eligible(p_jobsite)
$$;
do $$
declare f text;
begin
  foreach f in array array[
    'marketing_queue_read(integer, integer)', 'marketing_queue_delete(bigint)',
    'marketing_queue_archive(bigint)', 'marketing_queue_delay(bigint, integer)',
    'marketing_is_eligible(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke all on function app.marketing_eligible(uuid) from public, anon, authenticated;
revoke all on function app.marketing_enqueue(uuid) from public, anon, authenticated;

-- Tâche planifiée (mêmes secrets du coffre que les autres files).
select cron.schedule('marketing-candidates', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/marketing-candidates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb)
  where exists (select 1 from pgmq.q_marketing_generation)
$cron$);
