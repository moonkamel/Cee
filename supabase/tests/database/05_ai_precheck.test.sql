-- Pré-contrôle IA (section 8, S10) : file d'analyse, verdict réservé au serveur, quota.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, aud, role, phone) values
  ('e1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639987001'),
  ('e1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639987005');
insert into public.companies (id, name, ai_daily_quota) values
  ('e0000000-0000-4000-8000-000000000001', 'Entreprise E', 2);
insert into public.profiles (id, company_id, role, full_name) values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'owner', 'Dirigeant E'),
  ('e1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'installer', 'Poseur E');
insert into public.checklist_templates (id, company_id, code, trade, version, title, content, published) values
  ('ec000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'E_TEST', 'chauffage', '1.0.0', 'E', '{"items":[]}', true);
insert into public.jobsites (id, company_id, address) values
  ('e4000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Chantier E');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('e4000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001');
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label) values
  ('e6000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001',
   'BAR-TH-171', 'ec000000-0000-4000-8000-000000000001', '1.0.0', '{"items":[]}', 'PAC');
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, status) values
  ('e7000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001',
   'e6000000-0000-4000-8000-000000000001', 'plate', 'Plaque', 'apres', 'captured');
insert into public.photos (id, company_id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path) values
  ('e8000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001',
   'e7000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000005', now(), repeat('e', 64), 'e/p1.jpg'),
  ('e8000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001',
   null, 'e1000000-0000-4000-8000-000000000005', now(), repeat('f', 64), 'e/p2.jpg');

-- File d'analyse --------------------------------------------------------------------------------
update public.photos set upload_status = 'verified' where id in
  ('e8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-000000000002');
select is((select count(*)::int from pgmq.q_photo_analysis where message ->> 'photo_id' = 'e8000000-0000-4000-8000-000000000001'),
  1, 'une photo de preuve vérifiée entre dans la file d''analyse');
select is((select status::text from public.proof_slots where id = 'e7000000-0000-4000-8000-000000000001'), 'analyzing',
  'sa preuve passe « en analyse »');
select is((select count(*)::int from pgmq.q_photo_analysis where message ->> 'photo_id' = 'e8000000-0000-4000-8000-000000000002'),
  0, 'une photo libre n''est pas analysée une à une');
select is((select ai_status from public.photos where id = 'e8000000-0000-4000-8000-000000000002'), 'skipped',
  'la photo libre est marquée « sans analyse »');
select is((select photo_id from public.ai_queue_read(10, 60) limit 1), 'e8000000-0000-4000-8000-000000000001'::uuid,
  'la fonction d''analyse lit la file');
select is((select count(*)::int from public.ai_queue_read(10, 60)), 0,
  'un message lu est invisible le temps de son analyse');

-- Quota ------------------------------------------------------------------------------------------
select is(public.ai_quota_take('e0000000-0000-4000-8000-000000000001'), true, 'première analyse du jour accordée');
select is(public.ai_quota_take('e0000000-0000-4000-8000-000000000001'), true, 'deuxième analyse accordée (quota 2)');
select is(public.ai_quota_take('e0000000-0000-4000-8000-000000000001'), false, 'quota atteint : analyse refusée');
select ok((select quota_reached_at is not null from public.ai_usage where company_id = 'e0000000-0000-4000-8000-000000000001'),
  'le dépassement est noté (alerte interne)');

-- Côté poseur ------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$update public.photos set ai_status = 'done', ai_result = '{"decision":{"kind":"compliant"}}'
    where id = 'e8000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur n''écrit jamais un verdict IA');
select lives_ok(
  $$update public.photos set ai_kept_at = now() where id = 'e8000000-0000-4000-8000-000000000001'$$,
  'le poseur garde une photo malgré l''alerte orange');
select throws_ok(
  $$update public.photos set ai_kept_at = null where id = 'e8000000-0000-4000-8000-000000000001'$$,
  '42501', null, '« Garder quand même » ne s''annule pas');
select throws_ok($$select public.ai_quota_take('e0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'le poseur n''accède ni au quota ni à la file');
select is((select count(*)::int from public.ai_usage), 0, 'le poseur ne voit pas la consommation IA');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select calls from public.ai_usage where company_id = 'e0000000-0000-4000-8000-000000000001'), 2,
  'le dirigeant voit la consommation IA de son entreprise');
reset role;

select * from finish();
rollback;
