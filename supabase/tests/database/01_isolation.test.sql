-- Isolement entre entreprises (sections 5 et 16) : critère de fin de S3.
-- Un utilisateur de l'entreprise A ne lit, ne crée, ne modifie ni ne supprime rien de l'entreprise B.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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

-- Structure ------------------------------------------------------------------------------
select is(
  (select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity),
  null, 'RLS est activée sur toutes les tables de public');

select is(
  (select string_agg(c.table_name, ', ') from information_schema.columns c
   join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
   where c.table_schema = 'public' and c.column_name = 'company_id' and tb.table_type = 'BASE TABLE'
     and c.table_name <> 'audit_log'
     and not exists (select 1 from pg_trigger tg where tg.tgrelid = ('public.' || c.table_name)::regclass
                     and tg.tgname = 'a_set_company_id')),
  null, 'company_id est imposé par trigger sur chaque table métier');

select ok(
  (select count(*) from regexp_split_to_table(public._tables_with_rows_of('b0000000-0000-4000-8000-000000000001'), ', ')) >= 23,
  'les données de test couvrent les 23 tables portant company_id');

-- Anonyme ----------------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.jobsites', '42501', null, 'anon n''a aucun accès aux chantiers');
select throws_ok('select * from public.photos', '42501', null, 'anon n''a aucun accès aux photos');
reset role;

-- Lecture : le dirigeant de A ne voit rien de B -------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public._tables_with_rows_of('b0000000-0000-4000-8000-000000000001'), '',
  'le dirigeant de A ne lit aucune ligne de B, dans aucune table');
select is((select count(*) from public.companies where id = 'b0000000-0000-4000-8000-000000000001'), 0::bigint,
  'A ne voit pas la fiche de l''entreprise B');
select is((select count(*) from storage.objects where name like 'b0000000-0000-4000-8000-000000000001/%'), 0::bigint,
  'A ne voit aucun fichier de B');
select ok(public._tables_with_rows_of('a0000000-0000-4000-8000-000000000001') like '%jobsites%',
  'A voit bien ses propres chantiers');

-- Écriture : rien ne passe vers B --------------------------------------------------------
-- Tentatives silencieuses : RLS les réduit à 0 ligne ; le résultat est vérifié plus bas.
update public.jobsites set address = 'piraté' where id = 'b4000000-0000-4000-8000-000000000001';
update public.photos set caption = 'piraté' where id = 'b8000000-0000-4000-8000-000000000001';
delete from public.clients where id = 'b3000000-0000-4000-8000-000000000001';
update public.companies set name = 'piraté' where id = 'b0000000-0000-4000-8000-000000000001';

select lives_ok(
  $$insert into public.jobsites (id, company_id, address)
    values ('a4000000-0000-4000-8000-000000000099', 'b0000000-0000-4000-8000-000000000001', 'Tentative vers B')$$,
  'un chantier créé en visant B est accepté…');
select is(
  (select company_id from public.jobsites where id = 'a4000000-0000-4000-8000-000000000099'),
  'a0000000-0000-4000-8000-000000000001'::uuid, '… mais il est rangé d''office dans A');

select throws_ok(
  $$insert into public.photos (jobsite_id, author_id, device_taken_at, sha256, original_path)
    values ('b4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', now(), repeat('e', 64), 'x.jpg')$$,
  null, null, 'A ne rattache pas une photo à un chantier de B');
select throws_ok(
  $$insert into public.jobsite_assignees (jobsite_id, profile_id, company_id)
    values ('a4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001')$$,
  null, null, 'A n''affecte pas un poseur de B à son chantier');
select throws_ok(
  $$update public.jobsites set delegataire_id = 'b5000000-0000-4000-8000-000000000001'
    where id = 'a4000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'A n''utilise pas le délégataire privé de B');
select lives_ok(
  $$update public.jobsites set delegataire_id = 'd0000000-0000-4000-8000-000000000001'
    where id = 'a4000000-0000-4000-8000-000000000001'$$,
  'A utilise un délégataire global');
select throws_ok(
  $$update public.clients set company_id = 'b0000000-0000-4000-8000-000000000001'
    where id = 'a3000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'A ne déplace pas une ligne vers B');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'b0000000-0000-4000-8000-000000000001/x/intrus.jpg')$$,
  '42501', null, 'A ne dépose pas de fichier dans le dossier de B');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'a0000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/ok.jpg')$$,
  'A dépose un fichier dans son propre dossier');

reset role;
select is((select address from public.jobsites where id = 'b4000000-0000-4000-8000-000000000001'), 'Chantier B1',
  'A n''a pas modifié le chantier de B');
select is((select caption from public.photos where id = 'b8000000-0000-4000-8000-000000000001'), null,
  'A n''a pas modifié la photo de B');
select is((select count(*) from public.clients where id = 'b3000000-0000-4000-8000-000000000001'), 1::bigint,
  'A n''a pas supprimé le client de B');
select is((select name from public.companies where id = 'b0000000-0000-4000-8000-000000000001'), 'Entreprise B',
  'A n''a pas modifié l''entreprise B');
set local role authenticated;

-- Symétrie et compte désactivé -------------------------------------------------------------
set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public._tables_with_rows_of('a0000000-0000-4000-8000-000000000001'), '',
  'le dirigeant de B ne lit aucune ligne de A');

reset role;
update public.profiles set active = false where id = 'a1000000-0000-4000-8000-000000000005';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is(public._tables_with_rows_of('a0000000-0000-4000-8000-000000000001'), '',
  'un salarié désactivé ne voit plus rien');
reset role;

select * from finish();
rollback;
