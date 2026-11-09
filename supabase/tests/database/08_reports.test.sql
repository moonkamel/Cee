-- Rapports (section 9, S13) : versions conservées, PDF définitif, file de rédaction, QR code.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, aud, role, phone) values
  ('71000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639987003'),
  ('71000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639987005'),
  ('71000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', '33639987009');
insert into public.companies (id, name) values
  ('70000000-0000-4000-8000-000000000001', 'Entreprise R'),
  ('70000000-0000-4000-8000-000000000002', 'Entreprise S');
insert into public.profiles (id, company_id, role, full_name) values
  ('71000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', 'office', 'Bureau R'),
  ('71000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 'installer', 'Poseur R'),
  ('71000000-0000-4000-8000-000000000009', '70000000-0000-4000-8000-000000000002', 'owner', 'Dirigeant S');
insert into public.jobsites (id, company_id, reference, address, status) values
  ('74000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'CH-R-1', 'Chantier R', 'in_progress');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001');
insert into public.photos (id, company_id, jobsite_id, author_id, device_taken_at, sha256, original_path) values
  ('7e000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001',
   '71000000-0000-4000-8000-000000000005', '2026-11-09 10:00:00+00', repeat('a', 64), 'r/p1.jpg');

-- Côté serveur : la première version d'une série --------------------------------------------
select lives_ok(
  $$insert into public.reports (id, company_id, jobsite_id, kind, series_id, version, content)
    values ('7b000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001',
            '74000000-0000-4000-8000-000000000001', 'completion', '7c000000-0000-4000-8000-000000000001', 1,
            '{"written_by":"claude-sonnet-5-5"}')$$,
  'le serveur rédige la première version');

-- Côté bureau ---------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$insert into public.reports (id, jobsite_id, kind, series_id, version, content, pdf_path, pdf_sha256)
    values ('7b000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000001', 'completion',
            '7c000000-0000-4000-8000-000000000001', 2, '{"written_by":"bureau"}', 'faux.pdf', repeat('b', 64))$$,
  'le bureau enregistre sa version modifiée');
select is((select created_by::text || ':' || coalesce(pdf_path, '∅') from public.reports
  where id = '7b000000-0000-4000-8000-000000000002'),
  '71000000-0000-4000-8000-000000000003:∅', 'signée du bureau, sans PDF fourni d''avance');
select throws_ok(
  $$insert into public.reports (jobsite_id, kind, series_id, version, content)
    values ('74000000-0000-4000-8000-000000000001', 'completion', '7c000000-0000-4000-8000-000000000001', 4, '{}')$$,
  'P0001', null, 'pas de trou dans les versions');
select throws_ok(
  $$insert into public.reports (jobsite_id, kind, series_id, version, content)
    values ('74000000-0000-4000-8000-000000000001', 'dispute', '7c000000-0000-4000-8000-000000000001', 3, '{}')$$,
  'P0001', null, 'une version garde le type de sa série');
select throws_ok(
  $$insert into public.reports (jobsite_id, kind, version, content)
    values ('74000000-0000-4000-8000-000000000001', 'completion', 1, '{}')$$,
  '42501', null, 'le bureau n''ouvre pas de série : le serveur rédige');
select throws_ok(
  $$update public.reports set content = '{"x":1}' where id = '7b000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'une version ne se réécrit pas');
select lives_ok(
  $$update public.reports set pdf_path = '70000000-0000-4000-8000-000000000001/reports/r2.pdf',
    pdf_sha256 = repeat('c', 64) where id = '7b000000-0000-4000-8000-000000000002'$$,
  'le PDF est attaché à la version');
select ok((select pdf_created_at is not null from public.reports where id = '7b000000-0000-4000-8000-000000000002'),
  'date du PDF posée par la base');
select throws_ok(
  $$update public.reports set pdf_sha256 = repeat('d', 64), pdf_path = 'autre.pdf'
    where id = '7b000000-0000-4000-8000-000000000002'$$,
  'P0001', null, 'le PDF d''une version est définitif');
reset role;
select throws_ok(
  $$delete from public.reports where id = '7b000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'aucune version ne se supprime, même côté serveur');
set local role authenticated;
select lives_ok(
  $$select public.request_report('74000000-0000-4000-8000-000000000001', 'dispute',
    array['7e000000-0000-4000-8000-000000000001']::uuid[])$$,
  'le bureau demande un dossier de litige sur une photo');
select throws_ok(
  $$select public.request_report('74000000-0000-4000-8000-000000000001', 'dispute', array[]::uuid[])$$,
  'P0001', null, 'un dossier de litige porte sur au moins une photo');
select throws_ok(
  $$select public.request_report('74000000-0000-4000-8000-000000000001', 'dispute',
    array['7e000000-0000-4000-8000-000000000099']::uuid[])$$,
  'P0001', null, 'pas de photo d''un autre chantier');

-- Côté poseur ---------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"71000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$select public.request_report('74000000-0000-4000-8000-000000000001', 'completion')$$,
  '42501', null, 'le poseur ne commande pas de rapport');
select lives_ok(
  $$update public.jobsites set status = 'completed_by_installer' where id = '74000000-0000-4000-8000-000000000001'$$,
  'le poseur termine le chantier');

-- Autre entreprise et public -------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"71000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.reports), 0, 'une autre entreprise ne voit aucun rapport');
reset role;
set local role anon;
select is((select reference || ':' || version || ':' || pdf_sha256
  from public.verify_report('7b000000-0000-4000-8000-000000000002')),
  'CH-R-1:2:' || repeat('c', 64), 'le QR code affiche la référence et l''empreinte du PDF');
reset role;

-- Files et compte rendu de 18 h ------------------------------------------------------------------
select is((select string_agg(message ->> 'kind', ',' order by msg_id) from pgmq.q_report_generation
  where message ->> 'jobsite_id' = '74000000-0000-4000-8000-000000000001'),
  'dispute,completion', 'litige demandé et fin de chantier en file');
select is(
  array[app.enqueue_daily_reports('2026-11-09 14:00:00+00'),
        app.enqueue_daily_reports('2026-11-09 17:30:00+00')],
  array[0, 1], 'compte rendu du jour à 18 h (Paris) seulement, s''il y a eu de l''activité');

select * from finish();
rollback;
