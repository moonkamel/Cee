-- Notes vocales (section 9, S11) : transcription réservée au serveur, file, problèmes et matériel.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, aud, role, phone) values
  ('f1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639986003'),
  ('f1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639986005'),
  ('f1000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', '33639986009');
insert into public.companies (id, name) values
  ('f0000000-0000-4000-8000-000000000001', 'Entreprise F'),
  ('f0000000-0000-4000-8000-000000000002', 'Entreprise G');
insert into public.profiles (id, company_id, role, full_name) values
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'office', 'Bureau F'),
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'installer', 'Poseur F'),
  ('f1000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000002', 'owner', 'Dirigeant G');
insert into public.jobsites (id, company_id, address) values
  ('f4000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Chantier F');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001');

-- Côté poseur --------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select lives_ok(
  $$insert into public.voice_notes (id, jobsite_id, author_id, audio_path, duration_s, transcript, status)
    values ('f9000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001',
            'f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001/n.m4a', 12,
            'texte inventé', 'done')$$,
  'le poseur enregistre une note');
select is((select status || ':' || coalesce(transcript, '∅') from public.voice_notes
  where id = 'f9000000-0000-4000-8000-000000000001'), 'pending:∅',
  'le téléphone ne fournit ni transcription ni statut');
reset role;
select is((select count(*)::int from pgmq.q_voice_transcription), 0,
  'pas de transcription tant que l''audio n''est pas arrivé');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select lives_ok(
  $$update public.voice_notes set upload_status = 'uploaded' where id = 'f9000000-0000-4000-8000-000000000001'$$,
  'le téléphone signale l''audio envoyé');
reset role;
select is((select count(*)::int from pgmq.q_voice_transcription
  where message ->> 'voice_note_id' = 'f9000000-0000-4000-8000-000000000001'), 1,
  'la note entre dans la file de transcription');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$update public.voice_notes set transcript = 'piraté' where id = 'f9000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'le poseur n''écrit pas la transcription');
select throws_ok(
  $$insert into public.note_items (jobsite_id, voice_note_id, kind, summary)
    values ('f4000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000001', 'problem', 'x')$$,
  '42501', null, 'problèmes et matériel sont repérés par le serveur, pas saisis par le téléphone');
reset role;

-- Côté serveur -------------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
update public.voice_notes set status = 'done', transcript = 'il manque un raccord',
  transcript_clean = 'Il manque un raccord.' where id = 'f9000000-0000-4000-8000-000000000001';
insert into public.note_items (id, company_id, jobsite_id, voice_note_id, kind, summary) values
  ('fa000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001',
   'f9000000-0000-4000-8000-000000000001', 'problem', 'Raccord manquant');
select is((select transcript_clean from public.voice_notes where id = 'f9000000-0000-4000-8000-000000000001'),
  'Il manque un raccord.', 'le serveur écrit la transcription nettoyée');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.note_items where status = 'open'), 1, 'le bureau voit le problème signalé');
select lives_ok(
  $$update public.note_items set status = 'done' where id = 'fa000000-0000-4000-8000-000000000001'$$,
  'le bureau marque le problème traité');
select throws_ok(
  $$update public.note_items set summary = 'autre' where id = 'fa000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'ce que l''IA a repéré ne se réécrit pas');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.note_items), 0, 'une autre entreprise ne voit rien');
reset role;

select * from finish();
rollback;
