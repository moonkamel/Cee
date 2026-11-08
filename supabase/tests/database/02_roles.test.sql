-- Matrice des rôles (section 14) : poseur, chef d'équipe, bureau, admin, dirigeant.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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
  ('c0000000-0000-4000-8000-000000000001', null, 'PAC_TEST', 'chauffage', '1.0.0', 'PAC air/eau', '{"items":[]}', true),
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

set local role authenticated;

-- Poseur (Poseur A, équipe A1, affecté au chantier A1) ------------------------------------
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*) from public.jobsites), 1::bigint, 'le poseur ne voit que son chantier');
select lives_ok(
  $$insert into public.photos (jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path)
    values ('a4000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000005', now(), repeat('f', 64), 'p.jpg')$$,
  'le poseur photographie son chantier');
select throws_ok(
  $$insert into public.photos (jobsite_id, author_id, device_taken_at, sha256, original_path)
    values ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', now(), repeat('f', 64), 'p.jpg')$$,
  '42501', null, 'le poseur ne photographie pas le chantier d''un collègue');
select throws_ok(
  $$insert into public.photos (jobsite_id, author_id, device_taken_at, sha256, original_path)
    values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', now(), repeat('f', 64), 'p.jpg')$$,
  '42501', null, 'le poseur ne signe pas une photo au nom d''un autre');
select lives_ok(
  $$insert into public.jobsites (id, address) values ('a4000000-0000-4000-8000-000000000010', 'Créé sur le terrain');
    insert into public.jobsite_assignees (jobsite_id, profile_id)
    values ('a4000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000005')$$,
  'le poseur crée un chantier sur le terrain et s''y affecte');
select is((select count(*) from public.jobsites), 2::bigint, 'le poseur voit le chantier qu''il vient de créer');
-- L'API Supabase relit la ligne insérée (RETURNING) : la règle de lecture doit l'accepter
-- dans la même instruction, avant que le chantier soit visible des autres requêtes.
select lives_ok(
  $$insert into public.jobsites (id, address, status) values ('a4000000-0000-4000-8000-000000000011', 'Hors ligne', 'in_progress') returning id$$,
  'le poseur crée un chantier comme le fait l''API (insert … returning)');
select throws_ok(
  $$update public.proof_slots set status = 'manually_validated' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur ne tranche pas une preuve');
select throws_ok(
  $$update public.proof_slots set status = 'compliant' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur ne déclare pas une preuve conforme');
select lives_ok(
  $$update public.proof_slots set status = 'waived', waiver_reason = 'Accès impossible' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'le poseur marque une preuve « Impossible » avec un motif');
select throws_ok(
  $$update public.proof_slots set waiver_validated_at = now() where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur ne valide pas sa propre dispense');
select lives_ok(
  $$update public.jobsites set status = 'completed_by_installer' where id = 'a4000000-0000-4000-8000-000000000001'$$,
  'le poseur termine son chantier');
select throws_ok(
  $$update public.jobsites set status = 'verified_by_office' where id = 'a4000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur ne marque pas un chantier « vérifié par le bureau »');
select throws_ok(
  $$insert into public.exports (jobsite_ids) values (array['a4000000-0000-4000-8000-000000000001']::uuid[])$$,
  '42501', null, 'le poseur n''exporte pas de dossier');
select throws_ok(
  $$update public.profiles set role = 'owner' where id = 'a1000000-0000-4000-8000-000000000005'$$,
  '42501', null, 'le poseur ne s''attribue pas un autre rôle');
select is((select count(*) from public.audit_log), 0::bigint, 'le poseur ne lit pas le journal d''audit');
select throws_ok(
  $$insert into public.photo_requests (jobsite_id, requested_by, recipient_id)
    values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005')$$,
  '42501', null, 'le poseur ne crée pas de demande de reprise');
select throws_ok(
  $$insert into public.checklist_templates (code, trade, version, title, content) values ('X', 'x', '1', 'X', '{}')$$,
  '42501', null, 'le poseur ne crée pas de modèle de checklist');

-- Chef d'équipe (équipe A1) -------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(
  (select array_agg(address order by address) from public.jobsites),
  array['Chantier A1', 'Créé sur le terrain'],
  'le chef voit les chantiers de son équipe, pas ceux des autres poseurs');
select lives_ok(
  $$update public.proof_slots set waiver_validated_at = now() where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'le chef valide une dispense');
select is(
  (select waiver_validated_by from public.proof_slots where id = 'a7000000-0000-4000-8000-000000000001'),
  'a1000000-0000-4000-8000-000000000004'::uuid, 'la validation est signée du chef, pas d''un autre nom');
select lives_ok(
  $$insert into public.photo_requests (jobsite_id, requested_by, recipient_id, message)
    values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004',
            'a1000000-0000-4000-8000-000000000005', 'Plaque illisible')$$,
  'le chef demande une reprise au poseur');
select throws_ok(
  $$insert into public.exports (jobsite_ids) values (array['a4000000-0000-4000-8000-000000000001']::uuid[])$$,
  '42501', null, 'le chef n''exporte pas de dossier');

-- Bureau ------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public.jobsites), 4::bigint, 'le bureau voit tous les chantiers de l''entreprise');
select lives_ok(
  $$insert into public.jobsites (id, address) values ('a4000000-0000-4000-8000-000000000012', 'Saisi au bureau') returning id$$,
  'le bureau crée un chantier comme le fait l''API (insert … returning)');
select throws_ok(
  $$insert into public.photos (jobsite_id, author_id, device_taken_at, sha256, original_path)
    values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', now(), repeat('f', 64), 'p.jpg')$$,
  '42501', null, 'le bureau ne photographie pas');
select lives_ok(
  $$insert into public.exports (jobsite_ids) values (array['a4000000-0000-4000-8000-000000000001']::uuid[])$$,
  'le bureau exporte un dossier');
select lives_ok(
  $$update public.jobsites set status = 'verified_by_office' where id = 'a4000000-0000-4000-8000-000000000001'$$,
  'le bureau vérifie un chantier');

-- Admin et dirigeant ------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$update public.profiles set role = 'owner' where id = 'a1000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'l''admin ne nomme pas de dirigeant');
select lives_ok(
  $$update public.profiles set role = 'lead', team_id = 'a2000000-0000-4000-8000-000000000001'
    where id = 'a1000000-0000-4000-8000-000000000006'$$,
  'l''admin change le rôle et l''équipe d''un salarié');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok((select count(*) from public.audit_log) > 0, 'le dirigeant lit le journal d''audit');
select lives_ok(
  $$insert into public.checklist_templates (code, trade, version, title, content) values ('MAISON', 'chauffage', '1.0.0', 'Maison', '{}')$$,
  'le dirigeant crée un modèle maison');
update public.checklist_templates set title = 'piraté' where id = 'c0000000-0000-4000-8000-000000000001';
reset role;
select is((select title from public.checklist_templates where id = 'c0000000-0000-4000-8000-000000000001'), 'PAC air/eau',
  'personne ne modifie un modèle global, pas même un dirigeant');

select * from finish();
rollback;
