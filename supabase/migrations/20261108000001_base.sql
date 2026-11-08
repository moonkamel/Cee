-- Preuvio — S3 : socle (sections 5 et 16).
-- Schéma `app` : fonctions internes, non exposées par l'API (seuls `public` et `graphql_public` le sont).

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- Pas d'accès anonyme aux tables métier : la page client passera par une fonction serveur.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Valeurs de statut. Elles doivent rester identiques aux constantes de
-- packages/shared/src/statuses.ts (vérifié par packages/shared/src/sql-sync.test.ts).
-- ---------------------------------------------------------------------------
create domain public.user_role as text
  check (value in ('owner', 'admin', 'office', 'lead', 'installer'));

create domain public.jobsite_status as text
  check (value in ('planned', 'in_progress', 'completed_by_installer', 'verified_by_office', 'exported', 'inspected'));

create domain public.proof_slot_status as text
  check (value in ('missing', 'captured', 'analyzing', 'compliant', 'to_retake', 'manually_validated', 'waived'));

create domain public.proof_phase as text
  check (value in ('avant', 'pendant', 'apres'));

create domain public.inspection_result as text
  check (value in ('satisfactory', 'unsatisfactory', 'unverifiable'));

create domain public.sha256_hex as text
  check (value ~ '^[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------
-- Triggers génériques (aucune référence aux tables : utilisables partout).
-- ---------------------------------------------------------------------------

-- Met à jour updated_at à chaque modification.
create function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Refuse toute modification ou suppression (journal d'audit, signatures).
create function app.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% : les lignes de cette table ne peuvent être ni modifiées ni supprimées', tg_table_name
    using errcode = 'P0001';
end $$;
