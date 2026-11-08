-- Preuvio — S3 : tables du modèle de données (section 5).
--
-- Isolement : chaque table métier porte company_id. Les références entre tables d'une même
-- entreprise sont des clés étrangères composites (id, company_id) : une ligne ne peut jamais
-- pointer vers la donnée d'une autre entreprise, même en devinant son identifiant.
--
-- Exception assumée : checklist_templates et delegataires acceptent company_id NULL pour les
-- entrées globales maintenues par Preuvio (lisibles par tous, modifiables par Preuvio seul).

-- Entreprises -----------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  siret text check (siret ~ '^[0-9]{14}$'),
  address text,
  -- [{ "organisme": "Qualibat", "numero": "…", "domaines": ["PAC"], "date_fin": "2027-06-30" }]
  rge_qualifications jsonb not null default '[]' check (jsonb_typeof(rge_qualifications) = 'array'),
  logo_path text,
  brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  plan text not null default 'trial' check (plan in ('trial', 'solo', 'team', 'enterprise')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (id, company_id)
);

-- Un utilisateur appartient à une seule entreprise (V1).
create table public.profiles (
  id uuid primary key references auth.users (id),
  company_id uuid not null references public.companies (id),
  team_id uuid,
  role public.user_role not null default 'installer',
  full_name text not null,
  phone text,
  locale text not null default 'fr',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (team_id, company_id) references public.teams (id, company_id)
);
create index on public.profiles (company_id);
create index on public.profiles (team_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  full_name text not null,
  phone text,
  email text,
  address text,
  ban_id text, -- identifiant Base Adresse Nationale
  lat double precision,
  lng double precision,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index on public.clients (company_id);

-- Délégataires CEE : globaux (company_id NULL) ou propres à une entreprise.
create table public.delegataires (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id),
  name text not null,
  naming_pattern text not null default '{REF_CHANTIER}_{FICHE}_{ETAPE}_{N}.jpg',
  required_documents jsonb not null default '[]' check (jsonb_typeof(required_documents) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.delegataires (company_id);

-- Chantiers -------------------------------------------------------------------
create table public.jobsites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid,
  reference text,
  address text not null,
  ban_id text,
  lat double precision,
  lng double precision,
  geofence_radius_m integer not null default 150 check (geofence_radius_m between 10 and 5000),
  planned_start date,
  planned_end date,
  status public.jobsite_status not null default 'planned',
  delegataire_id uuid references public.delegataires (id),
  quote_reference text,
  cover_photo_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (client_id, company_id) references public.clients (id, company_id),
  check (planned_end is null or planned_start is null or planned_end >= planned_start)
);
create index on public.jobsites (company_id, planned_start);
create index on public.jobsites (company_id, status);

-- Poseurs affectés à un chantier.
create table public.jobsite_assignees (
  jobsite_id uuid not null,
  profile_id uuid not null,
  company_id uuid not null references public.companies (id),
  created_at timestamptz not null default now(),
  primary key (jobsite_id, profile_id),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (profile_id, company_id) references public.profiles (id, company_id)
);
create index on public.jobsite_assignees (profile_id);

-- Checklists ------------------------------------------------------------------
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id),
  code text not null,
  trade text not null,
  version text not null,
  title text not null,
  cee_operation text,
  content jsonb not null, -- modèle complet (section 7), validé par le schéma zod de packages/shared
  valid_from date,
  valid_to date,
  published boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (company_id, code, version)
);

create table public.jobsite_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  code text not null, -- ex. BAR-TH-171
  template_id uuid not null references public.checklist_templates (id),
  -- Version et contenu du modèle figés à la création (section 5, règles d'intégrité).
  template_version text not null,
  template_snapshot jsonb not null,
  label text not null,
  answers jsonb not null default '{}', -- réponses aux questions rapides
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id)
);
create index on public.jobsite_operations (jobsite_id);

create table public.proof_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  operation_id uuid not null,
  item_key text not null,
  instruction text not null,
  phase public.proof_phase not null,
  required boolean not null default true,
  min_photos integer not null default 1 check (min_photos >= 0),
  status public.proof_slot_status not null default 'missing',
  waiver_reason text,
  waiver_validated_by uuid references public.profiles (id),
  waiver_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  unique (operation_id, item_key),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (operation_id, company_id) references public.jobsite_operations (id, company_id),
  check (status <> 'waived' or waiver_reason is not null)
);
create index on public.proof_slots (jobsite_id);

-- Photos et notes ---------------------------------------------------------------
create table public.photos (
  id uuid primary key default gen_random_uuid(), -- généré sur le téléphone (hors ligne)
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  proof_slot_id uuid,
  author_id uuid not null,
  device_taken_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  gps_accuracy_m real,
  heading real,
  device_model text,
  app_version text,
  sha256 public.sha256_hex not null,
  perceptual_hash text,
  original_path text not null,
  thumbnail_path text,
  exif jsonb,
  source text not null default 'camera' check (source in ('camera', 'gallery_import')),
  outside_geofence boolean not null default false,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'verified')),
  ai_status text not null default 'pending' check (ai_status in ('pending', 'analyzing', 'done', 'failed', 'skipped')),
  ai_result jsonb,
  caption text,
  annotations jsonb not null default '[]', -- calque séparé : l'original n'est jamais modifié
  client_visible boolean not null default false,
  deleted_at timestamptz, -- suppression logique uniquement
  deleted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (proof_slot_id, company_id) references public.proof_slots (id, company_id),
  foreign key (author_id, company_id) references public.profiles (id, company_id),
  -- Une image importée de la galerie ne compte jamais comme preuve (section 6).
  check (source = 'camera' or proof_slot_id is null)
);
create index on public.photos (jobsite_id, device_taken_at);
create index on public.photos (proof_slot_id);
create index on public.photos (company_id, created_at desc);

alter table public.jobsites
  add foreign key (cover_photo_id, company_id) references public.photos (id, company_id);

create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  photo_id uuid,
  author_id uuid not null,
  audio_path text not null,
  duration_s real not null check (duration_s > 0 and duration_s <= 120),
  transcript text,
  transcript_clean text,
  status text not null default 'pending' check (status in ('pending', 'transcribing', 'done', 'failed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (photo_id, company_id) references public.photos (id, company_id),
  foreign key (author_id, company_id) references public.profiles (id, company_id)
);
create index on public.voice_notes (jobsite_id);

create table public.photo_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  proof_slot_id uuid,
  requested_by uuid not null,
  recipient_id uuid not null,
  message text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (proof_slot_id, company_id) references public.proof_slots (id, company_id),
  foreign key (requested_by, company_id) references public.profiles (id, company_id),
  foreign key (recipient_id, company_id) references public.profiles (id, company_id)
);
create index on public.photo_requests (recipient_id, status);

-- Rapports, signatures --------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  kind text not null check (kind in ('daily', 'completion', 'dispute', 'inspection_prep')),
  pdf_path text,
  version integer not null default 1 check (version > 0),
  content jsonb not null default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id)
);
create index on public.reports (jobsite_id);

-- PV de réception signés : jamais modifiés ni supprimés.
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  signer_name text not null,
  signed_at timestamptz not null default now(),
  signature_path text not null,
  document_sha256 public.sha256_hex not null,
  has_reserves boolean not null,
  reserves text,
  sms_verified boolean not null default false,
  marketing_consent boolean not null default false, -- case du PV (section 13)
  timestamp_token text, -- horodatage qualifié eIDAS (option)
  signer_ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  check (not has_reserves or reserves is not null)
);
create index on public.signatures (jobsite_id);

-- CEE : lots, contrôles, seuils ---------------------------------------------------
create table public.cee_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  delegataire_id uuid references public.delegataires (id),
  operation_code text not null,
  period_start date,
  period_end date,
  status text not null default 'open' check (status in ('open', 'submitted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index on public.cee_batches (company_id);

create table public.cee_batch_jobsites (
  batch_id uuid not null,
  jobsite_id uuid not null,
  company_id uuid not null references public.companies (id),
  primary key (batch_id, jobsite_id),
  foreign key (batch_id, company_id) references public.cee_batches (id, company_id),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id)
);
create index on public.cee_batch_jobsites (jobsite_id);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  batch_id uuid,
  kind text not null check (kind in ('on_site', 'by_contact')),
  body text, -- organisme de contrôle
  inspected_on date not null,
  result public.inspection_result not null,
  findings text,
  corrected_on date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (batch_id, company_id) references public.cee_batches (id, company_id)
);
create index on public.inspections (company_id, batch_id);

-- Seuils de non-conformité par année : jamais codés en dur (section 10).
create table public.cee_thresholds (
  year integer primary key check (year between 2020 and 2100),
  max_nonconformity_rate numeric(4, 3) not null check (max_nonconformity_rate between 0 and 1),
  source_url text
);
insert into public.cee_thresholds (year, max_nonconformity_rate, source_url) values
  (2026, 0.14, 'https://selectra.info/energie/actualites/renovation-energetique/controles-cee-non-conformite-fraude-arrete-juillet-2026'),
  (2027, 0.12, 'https://selectra.info/energie/actualites/renovation-energetique/controles-cee-non-conformite-fraude-arrete-juillet-2026'),
  (2028, 0.10, 'https://selectra.info/energie/actualites/renovation-energetique/controles-cee-non-conformite-fraude-arrete-juillet-2026');

-- Exports, liens client, marketing ------------------------------------------------
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  delegataire_id uuid references public.delegataires (id),
  jobsite_ids uuid[] not null check (cardinality(jobsite_ids) > 0),
  zip_path text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'sent', 'failed')),
  incomplete boolean not null default false,
  created_by uuid references public.profiles (id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.exports (company_id, created_at desc);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  token_hash public.sha256_hex not null unique, -- jeton stocké haché (section 12)
  expires_at timestamptz not null,
  scope jsonb not null default '{}',
  created_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id)
);

create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  before_photo_id uuid not null,
  after_photo_id uuid not null,
  square_path text,
  story_path text,
  generated_text text,
  tone text check (tone in ('sobre', 'chaleureux', 'technique')),
  status text not null default 'to_review' check (status in ('to_review', 'published', 'ignored')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id),
  foreign key (before_photo_id, company_id) references public.photos (id, company_id),
  foreign key (after_photo_id, company_id) references public.photos (id, company_id)
);

-- Abonnement, notifications, audit --------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('solo', 'team', 'enterprise')),
  seats integer not null default 1 check (seats > 0),
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  recipient_id uuid not null,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (recipient_id, company_id) references public.profiles (id, company_id)
);
create index on public.notifications (recipient_id, created_at desc);

-- Journal d'audit en ajout seul (section 16).
create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies (id),
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text,
  at timestamptz not null default now(),
  diff jsonb not null
);
create index on public.audit_log (company_id, at desc);
create index on public.audit_log (table_name, record_id);

-- updated_at automatique
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app.set_updated_at()', t);
  end loop;
end $$;
