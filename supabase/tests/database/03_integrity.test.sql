-- Règles d'intégrité (sections 5, 13 et 16) : preuves inaltérables, journal d'audit en ajout seul.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ===== Données de test (identiques dans chaque fichier, annulées par le rollback) =====
-- Entreprise A : owner, admin, office, lead + poseur (équipe A1), poseur sans équipe.
-- Entreprise B : owner, poseur, et au moins une ligne dans chaque table métier.
insert into auth.users (id, aud, role, phone) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639989001'),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '33639989002'),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639989003'),
  ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '33639989004'),
  ('a1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639989005'),
  ('a1000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', '33639989006'),
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639989011'),
  ('b1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639989015');

insert into public.companies (id, name) values
  ('a0000000-0000-4000-8000-000000000001', 'Entreprise A'),
  ('b0000000-0000-4000-8000-000000000001', 'Entreprise B');
insert into public.teams (id, company_id, name) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Équipe A1'),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Équipe B1');
insert into public.profiles (id, company_id, team_id, role, full_name) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', null, 'owner', 'Dirigeant A'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', null, 'admin', 'Admin A'),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', null, 'office', 'Bureau A'),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'lead', 'Chef A'),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'installer', 'Poseur A'),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', null, 'installer', 'Poseur A2'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', null, 'owner', 'Dirigeant B'),
  ('b1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'installer', 'Poseur B');

insert into public.clients (id, company_id, full_name) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Client A'),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Client B');
insert into public.delegataires (id, company_id, name) values
  ('d0000000-0000-4000-8000-000000000001', null, 'Délégataire global'),
  ('b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Délégataire privé B');
insert into public.checklist_templates (id, company_id, code, trade, version, title, content, published) values
  ('c0000000-0000-4000-8000-000000000001', null, 'PAC_AIR_EAU', 'chauffage', '1.0.0', 'PAC air/eau', '{"items":[]}', true),
  ('bc000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'PAC_B', 'chauffage', '1.0.0', 'Modèle B', '{"items":[]}', true);

insert into public.jobsites (id, company_id, client_id, address, delegataire_id) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Chantier A1', null),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', null, 'Chantier A2', null),
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'Chantier B1', 'b5000000-0000-4000-8000-000000000001');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001');

insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label) values
  ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'BAR-TH-171', 'c0000000-0000-4000-8000-000000000001', '1.0.0', '{"items":[]}', 'PAC air/eau'),
  ('b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'BAR-TH-171', 'bc000000-0000-4000-8000-000000000001', '1.0.0', '{"items":[]}', 'PAC air/eau');
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase) values
  ('a7000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000001', 'outdoor_unit_plate', 'Plaque de l''unité extérieure', 'apres'),
  ('b7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'b6000000-0000-4000-8000-000000000001', 'outdoor_unit_plate', 'Plaque', 'apres');
insert into public.photos (id, company_id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path) values
  ('a8000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', now(), repeat('a', 64),
   'a0000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/a8.jpg'),
  ('b8000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'b7000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', now(), repeat('b', 64),
   'b0000000-0000-4000-8000-000000000001/b4000000-0000-4000-8000-000000000001/b8.jpg');

insert into public.voice_notes (company_id, jobsite_id, author_id, audio_path, duration_s) values
  ('b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 'b/v.m4a', 12);
insert into public.photo_requests (company_id, jobsite_id, requested_by, recipient_id) values
  ('b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005');
insert into public.reports (company_id, jobsite_id, kind) values
  ('b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'completion');
insert into public.signatures (id, company_id, jobsite_id, signer_name, signature_path, document_sha256, has_reserves, marketing_consent) values
  ('ba000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'Client B', 'b/sig.png', repeat('c', 64), false, true);
insert into public.cee_batches (id, company_id, delegataire_id, operation_code) values
  ('bb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'BAR-TH-171');
insert into public.cee_batch_jobsites (batch_id, jobsite_id, company_id) values
  ('bb000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
insert into public.inspections (company_id, jobsite_id, batch_id, kind, inspected_on, result) values
  ('b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001',
   'on_site', current_date, 'unsatisfactory');
insert into public.exports (company_id, jobsite_ids) values
  ('b0000000-0000-4000-8000-000000000001', array['b4000000-0000-4000-8000-000000000001']::uuid[]);
insert into public.share_links (company_id, jobsite_id, token_hash, expires_at) values
  ('b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', repeat('d', 64), now() + interval '90 days');
insert into public.marketing_assets (company_id, jobsite_id, before_photo_id, after_photo_id) values
  ('b0000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000001');
insert into public.subscriptions (company_id, plan, status) values
  ('b0000000-0000-4000-8000-000000000001', 'team', 'active');
insert into public.notifications (company_id, recipient_id, kind) values
  ('b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'daily_summary');
insert into storage.objects (bucket_id, name) values
  ('photos', 'b0000000-0000-4000-8000-000000000001/b4000000-0000-4000-8000-000000000001/b8.jpg');

-- Tables (avec company_id) où des lignes de l'entreprise p_company sont visibles par l'utilisateur courant.
create function public._tables_with_rows_of(p_company uuid) returns text
language plpgsql as $$
declare t text; n bigint; v_found text[] := '{}';
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'company_id' and tb.table_type = 'BASE TABLE'
    order by 1
  loop
    execute format('select count(*) from public.%I where company_id = $1', t) into n using p_company;
    if n > 0 then v_found := v_found || t; end if;
  end loop;
  return array_to_string(v_found, ', ');
end $$;
grant execute on function public._tables_with_rows_of(uuid) to authenticated;
-- ===== Fin des données de test =====

-- Photos (vérifié aussi sans utilisateur connecté : même le serveur ne peut pas) -------------
select throws_ok(
  $$update public.photos set sha256 = repeat('0', 64) where id = 'a8000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'l''empreinte d''une photo ne change jamais');
select throws_ok(
  $$update public.photos set original_path = 'autre.jpg' where id = 'a8000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'le fichier original d''une photo ne change jamais');
select throws_ok(
  $$update public.photos set device_taken_at = now() - interval '1 day' where id = 'a8000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'l''heure de prise de vue ne change jamais');
select throws_ok(
  $$delete from public.photos where id = 'a8000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'une photo n''est jamais supprimée physiquement');
select throws_ok(
  $$insert into public.photos (company_id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path, source)
    values ('a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000005', now(), repeat('1', 64), 'g.jpg', 'gallery_import')$$,
  '23514', null, 'une image importée de la galerie ne remplit pas un emplacement de preuve');
select throws_ok(
  $$insert into public.photos (company_id, jobsite_id, author_id, device_taken_at, sha256, original_path)
    values ('a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000005', now(), 'pas-une-empreinte', 'x.jpg')$$,
  '23514', null, 'une empreinte SHA-256 mal formée est refusée');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select lives_ok(
  $$insert into public.photos (id, jobsite_id, author_id, device_taken_at, server_received_at, sha256, original_path)
    values ('a8000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000005', now(), '2020-01-01', repeat('2', 64), 'n.jpg')$$,
  'le poseur envoie une photo');
select is(
  (select server_received_at from public.photos where id = 'a8000000-0000-4000-8000-000000000002'), now(),
  'l''heure serveur est imposée par le serveur, pas par le téléphone');
-- Comme l'API (insert … returning), et la preuve passe « capturée » par le poseur (S6).
select lives_ok(
  $$insert into public.photos (id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path, heading, gps_accuracy_m)
    values ('a8000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000005', now(), repeat('3', 64), 'a/b/c.jpg', 182, 6) returning id$$,
  'le poseur envoie une photo de preuve comme le fait l''API');
select lives_ok(
  $$update public.proof_slots set status = 'captured' where id = 'a7000000-0000-4000-8000-000000000001' returning id$$,
  'la preuve passe « capturée » après la photo');
select lives_ok(
  $$update public.photos set upload_status = 'uploaded' where id = 'a8000000-0000-4000-8000-000000000003' returning id$$,
  'le poseur signale que le fichier est envoyé');
select throws_ok(
  $$update public.photos set upload_status = 'verified' where id = 'a8000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'le poseur ne marque pas lui-même sa photo vérifiée');
reset role;
select set_config('request.jwt.claims', '', true);
update public.photos set upload_status = 'verified' where id = 'a8000000-0000-4000-8000-000000000003';
select is((select upload_status from public.photos where id = 'a8000000-0000-4000-8000-000000000003'), 'verified',
  'le serveur marque la photo vérifiée après contrôle de l''empreinte');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}';
update public.photos set upload_status = 'uploaded' where id = 'a8000000-0000-4000-8000-000000000003';
select is((select upload_status from public.photos where id = 'a8000000-0000-4000-8000-000000000003'), 'verified',
  'un envoi tardif du téléphone ne fait pas régresser une photo vérifiée');
select is((select position from public.proof_slots where id = 'a7000000-0000-4000-8000-000000000001'), 0,
  'une preuve a une position dans son modèle (0 par défaut)');
select lives_ok(
  $$update public.photos set caption = 'Vue de face', annotations = '[{"type":"arrow"}]'
    where id = 'a8000000-0000-4000-8000-000000000002'$$,
  'légende et annotations (calque séparé) restent modifiables');
select lives_ok(
  $$update public.photos set deleted_at = now() where id = 'a8000000-0000-4000-8000-000000000002'$$,
  'une photo se supprime logiquement');
select is(
  (select deleted_by from public.photos where id = 'a8000000-0000-4000-8000-000000000002'),
  'a1000000-0000-4000-8000-000000000005'::uuid, 'la suppression est signée de son auteur');
select throws_ok(
  $$update public.photos set deleted_at = null where id = 'a8000000-0000-4000-8000-000000000002'$$,
  'P0001', null, 'une photo supprimée ne revient pas en silence');
reset role;

-- Version du modèle figée ------------------------------------------------------------------
select throws_ok(
  $$update public.jobsite_operations set template_snapshot = '{"items":["autre"]}'
    where id = 'a6000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'un chantier garde la version du modèle utilisée à sa création');

-- PV signés ----------------------------------------------------------------------------------
select throws_ok(
  $$update public.signatures set signer_name = 'Autre' where id = 'ba000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'un PV signé ne se modifie pas');
select throws_ok(
  $$delete from public.signatures where id = 'ba000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'un PV signé ne se supprime pas');

-- Journal d'audit -----------------------------------------------------------------------------
update public.clients set full_name = 'Client A renommé' where id = 'a3000000-0000-4000-8000-000000000001';
select is(
  (select diff from public.audit_log where table_name = 'clients' and action = 'update'
   and record_id = 'a3000000-0000-4000-8000-000000000001' order by id desc limit 1),
  '{"full_name": {"new": "Client A renommé", "old": "Client A"}}'::jsonb,
  'le journal garde la différence avant/après, colonne par colonne');
select throws_ok($$update public.audit_log set action = 'delete'$$, 'P0001', null,
  'le journal d''audit ne se modifie pas');
select throws_ok($$delete from public.audit_log$$, 'P0001', null, 'le journal d''audit ne se vide pas');
select throws_ok($$truncate public.audit_log$$, 'P0001', null, 'le journal d''audit ne se tronque pas');

-- Consentement marketing (section 13) ------------------------------------------------------------
select throws_ok(
  $$insert into public.marketing_assets (company_id, jobsite_id, before_photo_id, after_photo_id)
    values ('a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
            'a8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001')$$,
  'P0001', null, 'aucun contenu marketing sans consentement du client');

-- Seuils CEE (section 10) -------------------------------------------------------------------------
select is((select max_nonconformity_rate from public.cee_thresholds where year = 2028), 0.100::numeric(4,3),
  'le seuil 2028 est de 10 %');

select * from finish();
rollback;
