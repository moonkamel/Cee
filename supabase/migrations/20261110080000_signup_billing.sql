-- Inscription, essai et abonnements (section 15, S18).
-- La base fait foi pour les limites : essai de 30 jours ou 10 chantiers, puis lecture seule
-- 90 jours ; sièges selon l'offre ; plan et essai écrits seulement par le serveur (Stripe).
-- Règles identiques à companyAccess (packages/shared/src/billing).

-- Écritures du serveur : une fonction SECURITY DEFINER qui a vérifié l'appelant efface les
-- identifiants de session le temps de ses écritures (les gardes la traitent alors comme la clé
-- de service, auth.uid() nul), puis les rétablit.
create function app.act_as_server() returns text[]
language plpgsql set search_path = '' as $$
declare
  v_saved text[] := array[coalesce(current_setting('request.jwt.claims', true), ''),
                          coalesce(current_setting('request.jwt.claim.sub', true), '')];
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_saved;
end $$;
create function app.act_as_user(p_saved text[]) returns void
language sql set search_path = '' as $$
  select set_config('request.jwt.claims', p_saved[1], true), set_config('request.jwt.claim.sub', p_saved[2], true)
$$;
revoke all on function app.act_as_server() from public, anon, authenticated;
revoke all on function app.act_as_user(text[]) from public, anon, authenticated;

-- Entreprises -----------------------------------------------------------------------------------
alter table public.companies
  alter column trial_ends_at set default now() + interval '30 days',
  add column work_types public.work_type[] not null default '{}',
  add column stripe_customer_id text unique;
update public.companies set trial_ends_at = created_at + interval '30 days' where trial_ends_at is null;

alter table public.subscriptions
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column stripe_price_id text,
  add column cancel_at_period_end boolean not null default false;

-- Plan, essai et client Stripe : jamais changés depuis le navigateur.
create function app.companies_billing_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
     and (new.plan, new.trial_ends_at, new.stripe_customer_id)
         is distinct from (old.plan, old.trial_ends_at, old.stripe_customer_id) then
    raise exception 'Offre gérée par l''abonnement' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger e_companies_billing_guard before update on public.companies
  for each row execute function app.companies_billing_guard();

-- Chantier de démonstration : un par entreprise, hors essai, lots, exports et indicateurs.
alter table public.jobsites add column is_demo boolean not null default false;
create unique index jobsites_one_demo on public.jobsites (company_id) where is_demo;

-- Accès ----------------------------------------------------------------------------------------
create function app.company_access(p_company uuid, p_now timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_trial timestamptz;
  v_sub public.subscriptions;
  v_jobsites integer;
  v_from timestamptz;
  v_reason text;
begin
  select trial_ends_at into v_trial from public.companies where id = p_company;
  select * into v_sub from public.subscriptions where company_id = p_company;
  if v_sub.id is not null and v_sub.status in ('active', 'trialing', 'past_due') then
    return jsonb_build_object('kind', 'active', 'plan', v_sub.plan);
  end if;
  if v_sub.id is not null then
    v_from := coalesce(v_sub.current_period_end, p_now);
    v_reason := 'canceled';
  else
    select count(*) into v_jobsites from public.jobsites where company_id = p_company and not is_demo;
    if p_now < coalesce(v_trial, p_now) and v_jobsites < 10 then
      return jsonb_build_object('kind', 'trial',
        'days_left', ceil(extract(epoch from v_trial - p_now) / 86400)::int,
        'jobsites_left', 10 - v_jobsites);
    end if;
    v_from := least(coalesce(v_trial, p_now), p_now);
    v_reason := 'trial_ended';
  end if;
  if p_now < v_from + interval '90 days' then
    return jsonb_build_object('kind', 'read_only', 'reason', v_reason, 'until', v_from + interval '90 days');
  end if;
  return jsonb_build_object('kind', 'closed');
end $$;
revoke all on function app.company_access(uuid, timestamptz) from public, anon, authenticated;

-- Pour le bandeau du tableau de bord et de l'appli : l'accès de sa propre entreprise.
create function public.my_company_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select app.company_access(app.current_company_id())
$$;
revoke all on function public.my_company_access() from public, anon;
grant execute on function public.my_company_access() to authenticated;

create function app.can_write(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.company_access(p_company) ->> 'kind' in ('trial', 'active')
$$;

-- Utilisateurs actifs autorisés ; null : sans limite (offre Entreprise).
create function app.seat_limit(p_company uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case a ->> 'kind'
    when 'trial' then 10
    when 'active' then case a ->> 'plan' when 'solo' then 2 when 'team' then 10 else null end
    else 0 end
  from app.company_access(p_company) a
$$;

-- Nouveau chantier : pendant l'essai ou avec un abonnement (le chantier de démonstration passe).
create function app.jobsites_access_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not new.is_demo and not app.can_write(new.company_id) then
    raise exception 'Essai terminé : choisissez une offre pour créer un chantier' using errcode = 'P0002';
  end if;
  return new;
end $$;
create trigger e_jobsites_access_guard before insert on public.jobsites
  for each row execute function app.jobsites_access_guard();

create function app.jobsites_demo_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_demo is distinct from old.is_demo then
    raise exception 'Le chantier de démonstration le reste' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger e_jobsites_demo_guard before update of is_demo on public.jobsites
  for each row execute function app.jobsites_demo_guard();

-- Nouvel utilisateur ou réactivation : dans la limite des sièges de l'offre.
create function app.profiles_seat_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_used integer;
begin
  if auth.uid() is null or not new.active
     or (tg_op = 'UPDATE' and old.active) then
    return new;
  end if;
  if not app.can_write(new.company_id) then
    raise exception 'Essai terminé : choisissez une offre pour inviter' using errcode = 'P0002';
  end if;
  v_limit := app.seat_limit(new.company_id);
  select count(*) into v_used from public.profiles
  where company_id = new.company_id and active and id <> new.id;
  if v_limit is not null and v_used >= v_limit then
    raise exception 'Offre limitée à % utilisateurs : changez d''offre pour inviter', v_limit
      using errcode = 'P0002';
  end if;
  return new;
end $$;
create trigger e_profiles_seat_guard before insert or update of active on public.profiles
  for each row execute function app.profiles_seat_guard();

-- Photos d'exemple : jamais envoyées au pré-contrôle IA.
create or replace function app.photos_enqueue_analysis() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.upload_status = 'verified' and old.upload_status is distinct from 'verified'
     and new.proof_slot_id is not null and new.deleted_at is null
     and not exists (select 1 from public.jobsites j where j.id = new.jobsite_id and j.is_demo) then
    perform pgmq.send('photo_analysis', jsonb_build_object('photo_id', new.id));
    update public.proof_slots set status = 'analyzing'
      where id = new.proof_slot_id and company_id = new.company_id and status = 'captured';
  end if;
  return null;
end $$;

-- Inscription du dirigeant ---------------------------------------------------------------------
-- Compte confirmé (code SMS ou e-mail) sans profil → entreprise en essai et profil dirigeant.
create function public.create_company(
  p_name text, p_siret text, p_address text, p_rge jsonb, p_work_types text[],
  p_brand_color text, p_full_name text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_user auth.users;
  v_saved text[];
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Ce compte appartient déjà à une entreprise' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_full_name), '') = '' then
    raise exception 'Nom de l''entreprise et votre nom requis' using errcode = 'P0001';
  end if;
  select * into v_user from auth.users where id = v_uid;
  v_saved := app.act_as_server();
  insert into public.companies (name, siret, address, rge_qualifications, work_types, brand_color)
  values (trim(p_name), nullif(p_siret, ''), nullif(trim(coalesce(p_address, '')), ''),
          coalesce(p_rge, '[]'), coalesce(p_work_types, '{}')::public.work_type[],
          nullif(p_brand_color, ''))
  returning id into v_company;
  insert into public.profiles (id, company_id, role, full_name, phone, email)
  values (v_uid, v_company, 'owner', trim(p_full_name),
          case when v_user.phone is not null and v_user.phone <> '' then '+' || ltrim(v_user.phone, '+') end,
          nullif(v_user.email, ''));
  perform app.act_as_user(v_saved);
  return v_company;
end $$;
revoke all on function public.create_company(text, text, text, jsonb, text[], text, text) from public, anon;
grant execute on function public.create_company(text, text, text, jsonb, text[], text, text) to authenticated;

-- Chantier de démonstration : créé par le dirigeant comme un chantier ordinaire, puis ses
-- photos d'exemple sont marquées vérifiées et ses preuves conformes par le serveur.
create function public.finish_demo_jobsite(p_jobsite uuid) returns void
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
  update public.photos set upload_status = 'verified', ai_status = 'done', server_received_at = now()
  where jobsite_id = p_jobsite and upload_status <> 'verified';
  update public.proof_slots s set status = 'compliant'
  where s.jobsite_id = p_jobsite and s.status in ('missing', 'captured', 'analyzing')
    and exists (select 1 from public.photos p where p.proof_slot_id = s.id and p.deleted_at is null);
  perform app.act_as_user(v_saved);
end $$;
revoke all on function public.finish_demo_jobsite(uuid) from public, anon;
grant execute on function public.finish_demo_jobsite(uuid) to authenticated;

-- Export complet (résiliation) : un dossier par chantier, sans changer le statut du chantier.
alter table public.exports
  add column purpose text not null default 'delegataire' check (purpose in ('delegataire', 'archive'));
