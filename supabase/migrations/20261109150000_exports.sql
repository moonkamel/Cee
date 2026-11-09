-- Exports délégataires (section 11, S14) : pièces administratives du chantier, historique des
-- exports (un ZIP par chantier, regroupés par lot), ZIP définitif une fois rangé.

-- Pièces ajoutées par le bureau (devis signé, facture, attestations, offre CEE) ---------------
create table public.jobsite_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jobsite_id uuid not null,
  kind text not null check (kind in ('devis', 'facture', 'attestation', 'offre_cee', 'autre')),
  label text,
  file_path text not null,
  file_name text not null,
  -- Date du document (signature du devis, acceptation de l'offre, facture) : ordre des dates.
  document_date date,
  created_by uuid references public.profiles (id),
  deleted_at timestamptz, -- retrait logique : le fichier reste dans le stockage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (jobsite_id, company_id) references public.jobsites (id, company_id)
);
create index on public.jobsite_documents (jobsite_id);
alter table public.jobsite_documents enable row level security;
-- Pièces administratives : bureau, admin, dirigeant (comme les exports).
create policy jobsite_documents_select on public.jobsite_documents for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));
create policy jobsite_documents_insert on public.jobsite_documents for insert to authenticated
  with check (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));
create policy jobsite_documents_update on public.jobsite_documents for update to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));
create trigger a_set_company_id before insert or update on public.jobsite_documents
  for each row execute function app.set_company_id();
create trigger b_set_created_by before insert on public.jobsite_documents
  for each row execute function app.set_created_by();
create trigger c_freeze_jobsite_documents before update on public.jobsite_documents for each row
  execute function app.freeze_columns('id', 'jobsite_id', 'file_path', 'file_name', 'created_by', 'created_at');
create trigger no_delete before delete on public.jobsite_documents
  for each row execute function app.forbid_change();
create trigger set_updated_at before update on public.jobsite_documents
  for each row execute function app.set_updated_at();
create trigger z_audit after insert or update or delete on public.jobsite_documents
  for each row execute function app.audit();

-- Historique des exports ------------------------------------------------------------------------
alter table public.exports
  add column batch_id uuid not null default gen_random_uuid(), -- export groupé
  add column checks jsonb not null default '[]' check (jsonb_typeof(checks) = 'array'),
  add column zip_sha256 public.sha256_hex,
  add column zip_size bigint,
  add column error text,
  add column sent_to text,
  add column link_expires_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.exports drop constraint exports_status_check;
alter table public.exports add constraint exports_status_check
  check (status in ('pending', 'building', 'ready', 'sent', 'failed'));
create index on public.exports (company_id, batch_id);

-- Ce qui a été vérifié au moment de l'export ne change plus ; le ZIP rangé est définitif.
create function app.exports_freeze() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.jobsite_ids, new.delegataire_id, new.checks, new.incomplete, new.batch_id, new.created_by,
      new.created_at)
     is distinct from
     (old.jobsite_ids, old.delegataire_id, old.checks, old.incomplete, old.batch_id, old.created_by,
      old.created_at) then
    raise exception 'Un export garde ce qui a été vérifié : créez-en un nouveau' using errcode = 'P0001';
  end if;
  if old.zip_path is not null
     and (new.zip_path, new.zip_sha256, new.zip_size) is distinct from (old.zip_path, old.zip_sha256, old.zip_size) then
    raise exception 'Le ZIP d''un export est définitif' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger c_exports_freeze before update on public.exports
  for each row execute function app.exports_freeze();
create trigger no_delete before delete on public.exports
  for each row execute function app.forbid_change();
create trigger set_updated_at before update on public.exports
  for each row execute function app.set_updated_at();
