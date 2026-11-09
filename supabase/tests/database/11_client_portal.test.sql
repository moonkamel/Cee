-- Page client et PV (section 12, S16) : jeton haché, visibilité des photos, code SMS limité,
-- signature unique et définitive, mode client.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, aud, role, phone) values
  ('a9100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639989203'),
  ('a9100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639989205'),
  ('a9100000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', '33639989206');
insert into public.companies (id, name, phone, google_review_url) values
  ('a9000000-0000-4000-8000-000000000001', 'Entreprise C', '+33639980001', 'https://g.page/r/exemple');
insert into public.profiles (id, company_id, role, full_name) values
  ('a9100000-0000-4000-8000-000000000003', 'a9000000-0000-4000-8000-000000000001', 'office', 'Bureau C'),
  ('a9100000-0000-4000-8000-000000000005', 'a9000000-0000-4000-8000-000000000001', 'installer', 'Poseur C'),
  ('a9100000-0000-4000-8000-000000000006', 'a9000000-0000-4000-8000-000000000001', 'installer', 'Autre poseur C');
insert into public.clients (id, company_id, full_name, phone) values
  ('a9300000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'M. et Mme Guérin', '+33639980110');
insert into public.jobsites (id, company_id, client_id, reference, address) values
  ('a9400000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'a9300000-0000-4000-8000-000000000001',
   'CH-C-1', '14 Rue des Ajoncs 44400 Rezé');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('a9400000-0000-4000-8000-000000000001', 'a9100000-0000-4000-8000-000000000005', 'a9000000-0000-4000-8000-000000000001');
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label)
select 'a9600000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
       'BAR-TH-171', t.id, t.version, t.content, t.title
from public.checklist_templates t where t.company_id is null and t.code = 'PAC_AIR_EAU';
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, applicable) values
  ('a9700000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   'a9600000-0000-4000-8000-000000000001', 'outdoor_unit', 'Unité extérieure posée', 'apres', true),
  ('a9700000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   'a9600000-0000-4000-8000-000000000001', 'old_boiler', 'Ancienne chaudière', 'avant', false);
insert into public.photos (id, company_id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path,
                           upload_status, client_hidden, client_visible) values
  ('a9800000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   'a9700000-0000-4000-8000-000000000001', 'a9100000-0000-4000-8000-000000000005', now(), repeat('a', 64), 'p1.jpg', 'verified', false, false),
  ('a9800000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   'a9700000-0000-4000-8000-000000000001', 'a9100000-0000-4000-8000-000000000005', now(), repeat('b', 64), 'p2.jpg', 'verified', true, false),
  ('a9800000-0000-4000-8000-000000000003', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   null, 'a9100000-0000-4000-8000-000000000005', now(), repeat('c', 64), 'p3.jpg', 'verified', false, false),
  ('a9800000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   null, 'a9100000-0000-4000-8000-000000000005', now(), repeat('d', 64), 'p4.jpg', 'verified', false, true),
  ('a9800000-0000-4000-8000-000000000005', 'a9000000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001',
   'a9700000-0000-4000-8000-000000000002', 'a9100000-0000-4000-8000-000000000005', now(), repeat('e', 64), 'p5.jpg', 'verified', false, false);

-- Liens créés par le bureau : seule l'empreinte du jeton est stockée.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9100000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into public.share_links (id, jobsite_id, token_hash, expires_at, require_sms) values
  ('a9500000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001', app.token_hash('jeton-libre'),
   now() + interval '90 days', false),
  ('a9500000-0000-4000-8000-000000000002', 'a9400000-0000-4000-8000-000000000001', app.token_hash('jeton-sms'),
   now() + interval '90 days', true),
  ('a9500000-0000-4000-8000-000000000003', 'a9400000-0000-4000-8000-000000000001', app.token_hash('jeton-expire'),
   now() - interval '1 day', false);
reset role;

-- Le client (pas de compte) passe par le serveur -------------------------------------------------
select is(public.client_portal('jeton-inconnu'), null, 'jeton inconnu : rien');
select is(public.client_portal('jeton-expire'), null, 'lien expiré : rien');
select is((public.client_portal('jeton-libre') -> 'company' ->> 'name'), 'Entreprise C', 'jeton valable : la page s''ouvre');
select is((select array_agg(x ->> 'original_path' order by x ->> 'original_path')
           from jsonb_array_elements(public.client_portal('jeton-libre') -> 'photos') x),
  array['p1.jpg', 'p4.jpg'],
  'preuves visibles sauf masquées ; « Divers » masquées sauf montrées ; preuve écartée absente');
select ok((select last_seen_at is not null from public.share_links where id = 'a9500000-0000-4000-8000-000000000001'),
  'dernière consultation notée');
set local role anon;
select throws_ok($$select public.client_portal('jeton-libre')$$, '42501', null,
  'les fonctions du client sont réservées au serveur, pas au navigateur');
reset role;

-- Code SMS ---------------------------------------------------------------------------------------
select is(public.client_code_set('jeton-sms', app.token_hash('123456')), '+33639980110',
  'code envoyé au téléphone du client');
select is(public.client_sign('jeton-sms', 'Marc Guérin', null, 'pv/s.png', repeat('f', 64), '{}', false, '000000',
  '203.0.113.7', 'Navigateur'), null, 'mauvais code : refusé');
select is((select failed_attempts from public.share_links where id = 'a9500000-0000-4000-8000-000000000002'), 1,
  'l''essai manqué est compté');
update public.share_links set failed_attempts = 5 where id = 'a9500000-0000-4000-8000-000000000002';
select throws_ok($$select public.client_code_set('jeton-sms', 'x')$$, 'P0001', null, 'après 5 essais, le lien est bloqué');
update public.share_links set failed_attempts = 0 where id = 'a9500000-0000-4000-8000-000000000002';

-- Signature --------------------------------------------------------------------------------------
select throws_ok($$select public.client_sign('jeton-libre', '  ', null, 'p', repeat('f', 64), '{}', false, null, null, null)$$,
  'P0001', null, 'nom du signataire requis');
select isnt(public.client_sign('jeton-sms', 'Marc Guérin', 'Habillage à finir', 'pv/s.png', repeat('f', 64),
  '{"titre":"PV"}', true, '123456', '203.0.113.7', 'Navigateur'), null, 'bon code : PV signé avec réserves');
select is((select has_reserves::text || ':' || sms_verified || ':' || marketing_consent || ':' || host(signer_ip)
           from public.signatures where jobsite_id = 'a9400000-0000-4000-8000-000000000001'),
  'true:true:true:203.0.113.7', 'réserves, code vérifié, consentement, adresse IP enregistrés');
select throws_ok($$select public.client_sign('jeton-libre', 'X', null, 'p', repeat('f', 64), '{}', false, null, null, null)$$,
  'P0001', null, 'un seul PV par chantier');
select lives_ok($$select public.client_store_pv('jeton-sms',
  (select id from public.signatures where jobsite_id = 'a9400000-0000-4000-8000-000000000001'), 'pv/s.pdf', repeat('9', 64))$$,
  'le PDF du PV est attaché');
select throws_ok($$update public.signatures set pdf_path = 'autre.pdf'$$, 'P0001', null, 'le PDF du PV est définitif');
select throws_ok($$update public.signatures set reserves = 'aucune'$$, 'P0001', null, 'un PV signé ne change pas');
select throws_ok($$delete from public.signatures$$, 'P0001', null, 'un PV signé ne se supprime pas');
select is((public.client_portal('jeton-libre') -> 'signature' ->> 'pdf_path'), 'pv/s.pdf', 'la page montre le PV signé');

-- Mode client dans l'appli -------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9100000-0000-4000-8000-000000000005","role":"authenticated"}';
create temp table t_token as select public.client_mode_link('a9400000-0000-4000-8000-000000000001') as token;
reset role;
select is((select purpose || ':' || (expires_at < now() + interval '25 hours') from public.share_links
           where token_hash = app.token_hash((select token from t_token))), 'client_mode:true',
  'le poseur affecté obtient un lien d''un jour');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9100000-0000-4000-8000-000000000006","role":"authenticated"}';
select throws_ok($$select public.client_mode_link('a9400000-0000-4000-8000-000000000001')$$, '42501', null,
  'un poseur non affecté n''en obtient pas');
reset role;

select * from finish();
rollback;
