-- Recyclage marketing (section 13, S17) : file seulement pour un chantier terminé et conforme
-- avec consentement, proposition de l'IA figée, décision unique, notification, droits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, aud, role, phone) values
  ('c1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639989301'),
  ('c1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '33639989302'),
  ('c1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639989303');
insert into public.companies (id, name) values ('c1000000-0000-4000-8000-000000000001', 'Entreprise M');
insert into public.profiles (id, company_id, role, full_name) values
  ('c1100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'owner', 'Dirigeant M'),
  ('c1100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'office', 'Bureau M'),
  ('c1100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'installer', 'Poseur M');
insert into public.jobsites (id, company_id, reference, address, status) values
  ('c1400000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'CH-M-1',
   '14 Rue des Ajoncs 44400 Rezé', 'in_progress'),
  ('c1400000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'CH-M-2',
   '3 allée Verte 44000 Nantes', 'completed_by_installer');
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label)
select 'c1600000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
       'BAR-TH-171', t.id, t.version, t.content, t.title
from public.checklist_templates t where t.company_id is null and t.code = 'PAC_AIR_EAU';
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, status) values
  ('c1700000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
   'c1600000-0000-4000-8000-000000000001', 'facade', 'Façade', 'avant', 'compliant'),
  ('c1700000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
   'c1600000-0000-4000-8000-000000000001', 'outdoor_unit', 'Unité extérieure posée', 'apres', 'to_retake');
insert into public.photos (id, company_id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path, upload_status) values
  ('c1800000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
   'c1700000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000003', now(), repeat('a', 64), 'm1.jpg', 'verified'),
  ('c1800000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
   'c1700000-0000-4000-8000-000000000002', 'c1100000-0000-4000-8000-000000000003', now(), repeat('b', 64), 'm2.jpg', 'verified');

create temp view queued as
  select message ->> 'jobsite_id' as jobsite_id from pgmq.q_marketing_generation;
grant select on queued to authenticated;

-- PV signé avec consentement, mais chantier en cours et preuve à reprendre : pas encore.
insert into public.signatures (company_id, jobsite_id, signer_name, signature_path, document_sha256, has_reserves, marketing_consent) values
  ('c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001', 'Marc Guérin', 's.png', repeat('c', 64), false, true),
  ('c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000002', 'Client 2', 's2.png', repeat('d', 64), false, false);
select is((select count(*)::int from queued), 0, 'chantier en cours ou PV sans case cochée : rien en file');

update public.jobsites set status = 'completed_by_installer' where id = 'c1400000-0000-4000-8000-000000000001';
select is((select count(*)::int from queued), 0, 'preuve exigée à reprendre : rien en file');

update public.proof_slots set status = 'manually_validated' where id = 'c1700000-0000-4000-8000-000000000002';
select is((select array_agg(jobsite_id) from queued), array['c1400000-0000-4000-8000-000000000001'],
  'dernière preuve validée : le chantier part dans la file');
update public.jobsites set status = 'verified_by_office' where id = 'c1400000-0000-4000-8000-000000000001';
select is((select count(*)::int from queued), 1, 'pas de doublon dans la file');
select ok(not app.marketing_eligible('c1400000-0000-4000-8000-000000000002'), 'sans consentement : jamais éligible');

-- Contenu créé par le serveur → dirigeant prévenu.
insert into public.marketing_assets (id, company_id, jobsite_id, before_photo_id, after_photo_id, city, captions, tone, generated_text) values
  ('c1900000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
   'c1800000-0000-4000-8000-000000000001', 'c1800000-0000-4000-8000-000000000002', 'Rezé',
   '{"sobre":"PAC posée à Rezé.","chaleureux":"Bravo !","technique":"PAC air/eau."}', 'sobre', 'PAC posée à Rezé.');
select is((select array_agg(recipient_id::text) from public.notifications where kind = 'marketing_ready'),
  array['c1100000-0000-4000-8000-000000000001'], 'contenu prêt : le dirigeant est prévenu, pas le bureau');
select ok(not app.marketing_eligible('c1400000-0000-4000-8000-000000000001'), 'un contenu par chantier');
select throws_ok(
  $$insert into public.marketing_assets (company_id, jobsite_id, before_photo_id, after_photo_id) values
    ('c1000000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001',
     'c1800000-0000-4000-8000-000000000001', 'c1800000-0000-4000-8000-000000000002')$$,
  '23505', null, 'pas de second contenu pour le même chantier');

-- Droits : le bureau ne voit pas la file « À valider ».
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1100000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.marketing_assets), 0, 'le bureau ne voit pas les contenus');
select throws_ok($$select public.marketing_queue_read(1, 1)$$, '42501', null, 'la file est réservée au serveur');

-- Le dirigeant valide.
set local request.jwt.claims = '{"sub":"c1100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.marketing_assets), 1, 'le dirigeant voit le contenu');
select throws_ok(
  $$update public.marketing_assets set before_regions = '[]', captions = '{}' where id = 'c1900000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'la proposition de l''IA ne se modifie pas');
select throws_ok(
  $$update public.marketing_assets set square_path = 'autre/marketing/x.jpg' where id = 'c1900000-0000-4000-8000-000000000001'$$,
  '23514', null, 'visuel rangé dans le dossier de l''entreprise seulement');
select lives_ok(
  $$update public.marketing_assets set square_path = 'c1000000-0000-4000-8000-000000000001/marketing/c19-square.jpg'
    where id = 'c1900000-0000-4000-8000-000000000001'$$,
  'visuel composé attaché');
select lives_ok(
  $$update public.marketing_assets set tone = 'chaleureux', generated_text = 'Bravo à toute l''équipe !', status = 'published'
    where id = 'c1900000-0000-4000-8000-000000000001'$$,
  'légende retouchée et publiée');
select is((select reviewed_by::text from public.marketing_assets where id = 'c1900000-0000-4000-8000-000000000001'),
  'c1100000-0000-4000-8000-000000000001', 'décision signée par la base');
select throws_ok(
  $$update public.marketing_assets set status = 'ignored' where id = 'c1900000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'décision définitive');
reset role;
select throws_ok(
  $$delete from public.marketing_assets where id = 'c1900000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'un contenu ne se supprime pas');

select * from finish();
rollback;
