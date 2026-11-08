-- Preuvio — S3 : règles d'intégrité et journal d'audit (sections 5, 14 et 16).
-- Les triggers ne s'appliquent aux contrôles de rôle que pour un utilisateur connecté
-- (auth.uid() non nul) ; les fonctions serveur (service_role) gardent la main.
-- Ordre d'exécution : les triggers BEFORE d'une table s'exécutent par ordre alphabétique (a_, b_, c_…).

-- 1. company_id : imposé par le serveur à l'insertion, jamais modifiable ------------------
create function app.set_company_id() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      v_company := app.current_company_id();
      if v_company is null then
        raise exception 'Utilisateur sans entreprise active' using errcode = '42501';
      end if;
      new := jsonb_populate_record(new, jsonb_build_object('company_id', v_company));
    end if;
  elsif (to_jsonb(new) ->> 'company_id') is distinct from (to_jsonb(old) ->> 'company_id') then
    raise exception 'company_id ne peut pas être modifié' using errcode = '42501';
  end if;
  return new;
end $$;

-- 2. created_by : imposé à l'utilisateur connecté --------------------------------------------
create function app.set_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new := jsonb_populate_record(new, jsonb_build_object('created_by', auth.uid()));
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'company_id' and tb.table_type = 'BASE TABLE'
      and c.table_name <> 'audit_log'
  loop
    execute format('create trigger a_set_company_id before insert or update on public.%I
                    for each row execute function app.set_company_id()', t);
  end loop;
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'created_by'
  loop
    execute format('create trigger b_set_created_by before insert on public.%I
                    for each row execute function app.set_created_by()', t);
  end loop;
end $$;

-- 3. Colonnes figées après création ------------------------------------------------------
-- Arguments : noms des colonnes qui ne doivent jamais changer.
create function app.freeze_columns() returns trigger
language plpgsql set search_path = '' as $$
declare col text;
begin
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception '%.% ne peut pas être modifié', tg_table_name, col using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

-- Photos : jamais modifiées ni supprimées physiquement (section 5).
create trigger c_freeze_photos before update on public.photos for each row
  execute function app.freeze_columns('id', 'jobsite_id', 'author_id', 'device_taken_at', 'server_received_at',
    'lat', 'lng', 'gps_accuracy_m', 'heading', 'device_model', 'app_version', 'sha256', 'original_path',
    'source', 'created_at');

create function app.photos_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- L'heure serveur n'est jamais fournie par le téléphone.
    new.server_received_at := now();
    new.deleted_at := null;
    new.deleted_by := null;
  elsif old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'Une photo supprimée ne peut pas être restaurée ni modifiée' using errcode = 'P0001';
  elsif old.deleted_at is null and new.deleted_at is not null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  end if;
  return new;
end $$;
create trigger d_photos_guard before insert or update on public.photos
  for each row execute function app.photos_guard();
create trigger no_delete before delete on public.photos
  for each row execute function app.forbid_change();

create trigger c_freeze_voice_notes before update on public.voice_notes for each row
  execute function app.freeze_columns('id', 'jobsite_id', 'author_id', 'audio_path', 'duration_s', 'created_at');
create trigger no_delete before delete on public.voice_notes
  for each row execute function app.forbid_change();

-- Un chantier garde la version du modèle utilisée à sa création (section 5).
create trigger c_freeze_operations before update on public.jobsite_operations for each row
  execute function app.freeze_columns('jobsite_id', 'template_id', 'template_version', 'template_snapshot');

-- PV signés : intouchables.
create trigger no_change before update or delete on public.signatures
  for each row execute function app.forbid_change();

-- 4. Références partagées : un délégataire ou un modèle global, ou ceux de l'entreprise -----
-- Arguments : colonne de référence, table référencée.
create function app.check_shared_ref() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_owner uuid;
begin
  if v_id is null then
    return new;
  end if;
  execute format('select company_id from public.%I where id = $1', tg_argv[1]) into v_owner using v_id;
  if v_owner is not null and v_owner <> (to_jsonb(new) ->> 'company_id')::uuid then
    raise exception '% appartient à une autre entreprise', tg_argv[0] using errcode = '42501';
  end if;
  return new;
end $$;

create trigger e_check_delegataire before insert or update on public.jobsites
  for each row execute function app.check_shared_ref('delegataire_id', 'delegataires');
create trigger e_check_delegataire before insert or update on public.cee_batches
  for each row execute function app.check_shared_ref('delegataire_id', 'delegataires');
create trigger e_check_delegataire before insert or update on public.exports
  for each row execute function app.check_shared_ref('delegataire_id', 'delegataires');
create trigger e_check_template before insert or update on public.jobsite_operations
  for each row execute function app.check_shared_ref('template_id', 'checklist_templates');

-- Tous les chantiers d'un export appartiennent à l'entreprise.
create function app.exports_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.jobsite_ids) as x(id)
    left join public.jobsites j on j.id = x.id and j.company_id = new.company_id
    where j.id is null
  ) then
    raise exception 'Export : chantier inconnu ou d''une autre entreprise' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger e_exports_guard before insert or update on public.exports
  for each row execute function app.exports_guard();

-- Aucun contenu marketing sans consentement du client au PV (section 13).
create function app.marketing_consent_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.signatures s
    where s.jobsite_id = new.jobsite_id and s.company_id = new.company_id and s.marketing_consent
  ) then
    raise exception 'Pas de consentement marketing du client pour ce chantier' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger e_consent_guard before insert on public.marketing_assets
  for each row execute function app.marketing_consent_guard();

-- 5. Gardes de rôle (matrice de la section 14) --------------------------------------------
-- Profils : seuls admin et dirigeant changent un rôle, une équipe ou l'activation ;
-- seul le dirigeant nomme ou retire un dirigeant.
create function app.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'owner' and not app.has_role('owner') then
      raise exception 'Seul le dirigeant peut nommer un dirigeant' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.role, new.team_id, new.active) is distinct from (old.role, old.team_id, old.active) then
    if not app.has_role('admin', 'owner') then
      raise exception 'Seuls l''admin et le dirigeant gèrent les rôles et les équipes' using errcode = '42501';
    end if;
    if (new.role = 'owner' or old.role = 'owner') and new.role is distinct from old.role
       and not app.has_role('owner') then
      raise exception 'Seul le dirigeant peut nommer ou retirer un dirigeant' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger e_profiles_guard before insert or update on public.profiles
  for each row execute function app.profiles_guard();

-- Chantiers : un poseur ne fait avancer le statut que jusqu'à « terminé par le poseur ».
create function app.jobsites_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and new.status is distinct from (case when tg_op = 'UPDATE' then old.status end)
     and new.status not in ('planned', 'in_progress', 'completed_by_installer')
     and not app.has_role('office', 'admin', 'owner') then
    raise exception 'Statut % réservé au bureau', new.status using errcode = '42501';
  end if;
  return new;
end $$;
create trigger e_jobsites_guard before insert or update on public.jobsites
  for each row execute function app.jobsites_guard();

-- Preuves : « conforme » et « en analyse » viennent du serveur (IA) ; trancher une photo
-- orange ou valider une dispense est réservé au chef, au bureau, à l'admin et au dirigeant.
create function app.proof_slots_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old_status text := case when tg_op = 'UPDATE' then old.status end;
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.status is distinct from v_old_status then
    if new.status in ('compliant', 'analyzing') then
      raise exception 'Statut % attribué par le serveur uniquement', new.status using errcode = '42501';
    end if;
    if new.status in ('manually_validated', 'to_retake') and not app.has_role('lead', 'office', 'admin', 'owner') then
      raise exception 'Trancher une preuve est réservé au chef, au bureau et au dirigeant' using errcode = '42501';
    end if;
  end if;
  if (new.waiver_validated_at, new.waiver_validated_by) is distinct from
     (case when tg_op = 'UPDATE' then old.waiver_validated_at end,
      case when tg_op = 'UPDATE' then old.waiver_validated_by end) then
    if not app.has_role('lead', 'office', 'admin', 'owner') then
      raise exception 'Valider une dispense est réservé au chef, au bureau et au dirigeant' using errcode = '42501';
    end if;
    new.waiver_validated_by := auth.uid();
  end if;
  return new;
end $$;
create trigger e_proof_slots_guard before insert or update on public.proof_slots
  for each row execute function app.proof_slots_guard();

-- 6. Journal d'audit en ajout seul ---------------------------------------------------------
create function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k)), '{}')
      into v_diff
    from jsonb_object_keys(v_new) as k
    where k <> 'updated_at' and (v_old -> k) is distinct from (v_new -> k);
    if v_diff = '{}' then
      return null;
    end if;
  else
    v_diff := v_row;
  end if;

  insert into public.audit_log (company_id, actor_id, action, table_name, record_id, diff)
  values (
    case when tg_table_name = 'companies' then (v_row ->> 'id')::uuid else (v_row ->> 'company_id')::uuid end,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', concat_ws(':', v_row ->> 'jobsite_id', v_row ->> 'profile_id', v_row ->> 'batch_id')),
    v_diff
  );
  return null;
end $$;

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename not in ('audit_log', 'notifications')
  loop
    execute format('create trigger z_audit after insert or update or delete on public.%I
                    for each row execute function app.audit()', t);
  end loop;
end $$;

create trigger no_change before update or delete on public.audit_log
  for each row execute function app.forbid_change();
create trigger no_truncate before truncate on public.audit_log
  for each statement execute function app.forbid_change();
revoke insert, update, delete, truncate on public.audit_log from authenticated, service_role;
