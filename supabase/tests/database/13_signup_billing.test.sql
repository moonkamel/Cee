-- Inscription et abonnements (section 15, S18) : création de l'entreprise, essai (30 jours ou
-- 10 chantiers), lecture seule, sièges selon l'offre, offre protégée, chantier de démonstration.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, aud, role, phone) values
  ('d1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639989401'),
  ('d1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '33639989402'),
  ('d1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639989403'),
  ('d1100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '33639989404');

-- Inscription -------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.create_company('Énergie et Fils', '41816609600069', '3 allée Verte 44000 Nantes',
    '[{"organisme":"Qualibat","numero":"Q1"}]', array['pac_air_eau', 'combles'], '#1E40AF', 'Paul Martin')$$,
  'un compte confirmé crée son entreprise');
select is((select role || ':' || phone || ':' || full_name from public.profiles where id = 'd1100000-0000-4000-8000-000000000001'),
  'owner:+33639989401:Paul Martin', 'il en devient le dirigeant, avec son numéro');
select is((select name || ':' || array_to_string(work_types, ',') from public.companies),
  'Énergie et Fils:pac_air_eau,combles', 'entreprise et métiers enregistrés');
select throws_ok(
  $$select public.create_company('Autre', null, null, null, null, null, 'Paul')$$,
  'P0001', null, 'une seule entreprise par compte');
select is(public.my_company_access() ->> 'kind', 'trial', 'essai gratuit dès l''inscription');
select is((public.my_company_access() ->> 'days_left')::int, 30, 'essai de 30 jours');
select throws_ok(
  $$update public.companies set trial_ends_at = now() + interval '1 year'$$,
  '42501', null, 'l''essai ne se prolonge pas depuis le navigateur');
select throws_ok(
  $$update public.companies set plan = 'team'$$, '42501', null, 'l''offre non plus');

-- Chantier de démonstration ----------------------------------------------------------------------
insert into public.jobsites (id, company_id, address, is_demo)
select 'd1400000-0000-4000-8000-000000000099', id, '14 Rue des Ajoncs 44400 Rezé', true from public.companies;
select throws_ok(
  $$insert into public.jobsites (company_id, address, is_demo)
    select id, 'x', true from public.companies$$,
  '23505', null, 'un seul chantier de démonstration');
select throws_ok(
  $$update public.jobsites set is_demo = false where id = 'd1400000-0000-4000-8000-000000000099'$$,
  'P0001', null, 'il reste un chantier de démonstration');
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label)
select 'd1600000-0000-4000-8000-000000000001', j.company_id, j.id, 'BAR-TH-171', t.id, t.version, t.content, t.title
from public.jobsites j, public.checklist_templates t
where j.is_demo and t.company_id is null and t.code = 'PAC_AIR_EAU';
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase)
select 'd1700000-0000-4000-8000-000000000001', company_id, id, 'd1600000-0000-4000-8000-000000000001',
       'facade', 'Façade', 'avant'
from public.jobsites where is_demo;
insert into public.photos (company_id, jobsite_id, proof_slot_id, author_id, device_taken_at, sha256, original_path,
                           server_received_at)
select company_id, id, 'd1700000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', now(),
       repeat('a', 64), company_id || '/demo/facade.jpg', now() - interval '1 minute'
from public.jobsites where is_demo;
select lives_ok($$select public.finish_demo_jobsite('d1400000-0000-4000-8000-000000000099')$$,
  'photos d''exemple finalisées');
select is((select upload_status || ':' || ai_status from public.photos where jobsite_id = 'd1400000-0000-4000-8000-000000000099'),
  'verified:done', 'photo d''exemple vérifiée, sans analyse');
select is((select status::text from public.proof_slots where id = 'd1700000-0000-4000-8000-000000000001'),
  'compliant', 'preuve d''exemple conforme');
reset role;
select is((select count(*)::int from pgmq.q_photo_analysis), 0, 'aucune photo d''exemple envoyée à l''IA');
set local role authenticated;

-- Essai : 10 chantiers réels au plus, puis lecture seule -------------------------------------------
insert into public.jobsites (company_id, address)
select c.id, 'Chantier ' || g from public.companies c, generate_series(1, 9) g;
select is((public.my_company_access() ->> 'jobsites_left')::int, 1, 'le chantier de démonstration ne compte pas');
insert into public.jobsites (company_id, address) select id, 'Chantier 10' from public.companies;
select throws_ok(
  $$insert into public.jobsites (company_id, address) select id, 'Chantier 11' from public.companies$$,
  'P0002', null, '11e chantier : il faut choisir une offre');
select throws_ok(
  $$insert into public.profiles (id, company_id, role, full_name)
    select 'd1100000-0000-4000-8000-000000000002', id, 'installer', 'Poseur' from public.companies$$,
  'P0002', null, 'lecture seule : plus d''invitation');
reset role;

-- Abonnement Solo : écriture rouverte, 2 utilisateurs au plus ------------------------------------
insert into public.subscriptions (company_id, plan, status, current_period_end)
select id, 'solo', 'active', now() + interval '1 month' from public.companies where name = 'Énergie et Fils';
set local role authenticated;
insert into public.profiles (id, company_id, role, full_name)
select 'd1100000-0000-4000-8000-000000000002', id, 'installer', 'Poseur 1' from public.companies;
select throws_ok(
  $$insert into public.profiles (id, company_id, role, full_name)
    select 'd1100000-0000-4000-8000-000000000003', id, 'installer', 'Poseur 2' from public.companies$$,
  'P0002', null, 'offre Solo : 2 utilisateurs');
update public.profiles set active = false where id = 'd1100000-0000-4000-8000-000000000002';
select lives_ok(
  $$insert into public.profiles (id, company_id, role, full_name)
    select 'd1100000-0000-4000-8000-000000000003', id, 'installer', 'Poseur 2' from public.companies$$,
  'un départ libère un siège');
reset role;

-- Résiliation : lecture seule 90 jours après la fin de période, puis fermé ----------------------
update public.subscriptions set status = 'canceled', current_period_end = now() - interval '100 days'
where company_id = (select id from public.companies where name = 'Énergie et Fils');
select is((app.company_access((select id from public.companies where name = 'Énergie et Fils')) ->> 'kind'),
  'closed', '90 jours après la résiliation : accès fermé');

select * from finish();
rollback;
