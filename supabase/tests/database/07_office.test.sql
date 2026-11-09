-- Tableau de bord (sections 10 et 14, S12) : trancher, demande de reprise, notification, jetons.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, aud, role, phone) values
  ('d1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639985001'),
  ('d1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639985005');
insert into public.companies (id, name) values ('dd000000-0000-4000-8000-000000000001', 'Entreprise D');
insert into public.profiles (id, company_id, role, full_name) values
  ('d1000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', 'owner', 'Dirigeant D'),
  ('d1000000-0000-4000-8000-000000000005', 'dd000000-0000-4000-8000-000000000001', 'installer', 'Poseur D');
insert into public.checklist_templates (id, company_id, code, trade, version, title, content, published) values
  ('dc000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', 'D_TEST', 'chauffage', '1.0.0', 'D', '{"items":[]}', true);
insert into public.jobsites (id, company_id, address) values
  ('d4000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', 'Chantier D');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000005', 'dd000000-0000-4000-8000-000000000001');
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label) values
  ('d6000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001',
   'BAR-TH-171', 'dc000000-0000-4000-8000-000000000001', '1.0.0', '{"items":[]}', 'PAC');
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, status) values
  ('d7000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001',
   'd6000000-0000-4000-8000-000000000001', 'plate', 'Plaque de l''unité extérieure', 'apres', 'to_retake'),
  ('d7000000-0000-4000-8000-000000000002', 'dd000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001',
   'd6000000-0000-4000-8000-000000000001', 'unit', 'Unité extérieure', 'apres', 'to_retake');

-- Le dirigeant tranche ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$update public.proof_slots set status = 'manually_validated' where id = 'd7000000-0000-4000-8000-000000000002'$$,
  'le dirigeant valide une photo orange');
select lives_ok(
  $$insert into public.photo_requests (jobsite_id, proof_slot_id, requested_by, recipient_id, message)
    values ('d4000000-0000-4000-8000-000000000001', 'd7000000-0000-4000-8000-000000000001',
            'd1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000005',
            'Plaque illisible, rapprochez-vous')$$,
  'le dirigeant demande une reprise au poseur');
reset role;
select is((select payload ->> 'body' from public.notifications
  where recipient_id = 'd1000000-0000-4000-8000-000000000005' and kind = 'photo_request'),
  'Plaque illisible, rapprochez-vous', 'la demande crée une notification pour le poseur');
select is((select payload ->> 'proof_slot_id' from public.notifications
  where recipient_id = 'd1000000-0000-4000-8000-000000000005'),
  'd7000000-0000-4000-8000-000000000001', 'la notification ouvre la caméra sur la bonne preuve');

-- Le poseur reçoit la demande et reprend la photo ------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*)::int from public.photo_requests where status = 'open'), 1,
  'le poseur voit la demande qui lui est adressée');
select throws_ok(
  $$update public.proof_slots set status = 'manually_validated' where id = 'd7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur ne tranche pas lui-même');
select throws_ok(
  $$insert into public.photo_requests (jobsite_id, requested_by, recipient_id)
    values ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005')$$,
  '42501', null, 'le poseur ne crée pas de demande de reprise');
select lives_ok(
  $$insert into public.photos (id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path)
    values ('d8000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001',
            'd7000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000005', now(),
            repeat('d', 64), 'dd000000-0000-4000-8000-000000000001/d.jpg')$$,
  'le poseur reprend la photo');
select is((select status from public.photo_requests where proof_slot_id = 'd7000000-0000-4000-8000-000000000001'),
  'done', 'la nouvelle photo clôt la demande');
select lives_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[d]', 'd1000000-0000-4000-8000-000000000005', 'android')$$,
  'le téléphone enregistre son jeton push');
select throws_ok(
  $$insert into public.push_tokens (token, profile_id, platform)
    values ('ExponentPushToken[x]', 'd1000000-0000-4000-8000-000000000001', 'ios')$$,
  '42501', null, 'personne n''enregistre un jeton pour un autre');
reset role;

select * from finish();
rollback;
