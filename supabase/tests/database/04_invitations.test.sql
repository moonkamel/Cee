-- Invitation d'un salarié (section 14) : l'Edge Function invite-member crée le profil avec la
-- session de l'appelant ; ce sont donc la RLS et les triggers testés ici qui décident.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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

-- Comptes créés par la fonction serveur (étape 2), avant le profil.
insert into auth.users (id, aud, role, phone) values
  ('a1000000-0000-4000-8000-000000000020', 'authenticated', 'authenticated', '33639989020'),
  ('a1000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', '33639989021'),
  ('a1000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', '33639989022');

set local role authenticated;

-- Poseur : ne peut inviter personne
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$insert into public.profiles (id, full_name, role) values ('a1000000-0000-4000-8000-000000000020', 'Nouveau', 'installer')$$,
  '42501', null, 'un poseur n''invite pas de salarié');

-- Bureau : non plus
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$insert into public.profiles (id, full_name, role) values ('a1000000-0000-4000-8000-000000000020', 'Nouveau', 'installer')$$,
  '42501', null, 'le bureau n''invite pas de salarié');

-- Admin : invite un poseur, rangé d'office dans son entreprise, même en visant B
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$insert into public.profiles (id, company_id, full_name, role, team_id)
    values ('a1000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001', 'Nouveau poseur',
            'installer', 'a2000000-0000-4000-8000-000000000001')$$,
  'l''admin invite un poseur dans une équipe');
select is((select company_id from public.profiles where id = 'a1000000-0000-4000-8000-000000000020'),
  'a0000000-0000-4000-8000-000000000001'::uuid, 'l''invité rejoint l''entreprise de l''admin, jamais une autre');
select throws_ok(
  $$insert into public.profiles (id, full_name, role) values ('a1000000-0000-4000-8000-000000000021', 'Faux dirigeant', 'owner')$$,
  '42501', null, 'l''admin ne peut pas inviter un dirigeant');
select throws_ok(
  $$insert into public.profiles (id, full_name, role, team_id)
    values ('a1000000-0000-4000-8000-000000000021', 'Intrus', 'installer', 'b2000000-0000-4000-8000-000000000001')$$,
  null, null, 'l''admin ne place pas un invité dans une équipe de B');

-- Dirigeant : peut inviter un autre dirigeant
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$insert into public.profiles (id, full_name, role) values ('a1000000-0000-4000-8000-000000000022', 'Associé', 'owner')$$,
  'le dirigeant invite un associé dirigeant');
reset role;

select * from finish();
rollback;
