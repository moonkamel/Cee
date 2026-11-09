-- Lots CEE et alertes (section 10, S15) : préférences, alertes du tableau, niveau des lots,
-- reprise après contrôle, récapitulatif du matin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, aud, role, phone) values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639989101'),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639989103'),
  ('91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '33639989104'),
  ('91000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '33639989105');
insert into public.companies (id, name, rge_qualifications) values
  ('90000000-0000-4000-8000-000000000001', 'Entreprise L',
   '[{"organisme":"Qualit''EnR","numero":"QPAC/9","date_fin":"2026-12-15"},{"numero":"LOIN","date_fin":"2028-01-01"}]');
insert into public.teams (id, company_id, name) values
  ('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'Équipe L');
insert into public.profiles (id, company_id, team_id, role, full_name) values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', null, 'owner', 'Dirigeant L'),
  ('91000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', null, 'office', 'Bureau L'),
  ('91000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'lead', 'Chef L'),
  ('91000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'installer', 'Poseur L');
insert into public.jobsites (id, company_id, reference, address, status) values
  ('94000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'CH-L-1', 'Chantier L', 'in_progress');
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('94000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001');
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label)
select '96000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
       'BAR-TH-171', t.id, t.version, t.content, t.title
from public.checklist_templates t where t.company_id is null and t.code = 'PAC_AIR_EAU';
insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, position, status, updated_at) values
  ('97000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
   '96000000-0000-4000-8000-000000000001', 'outdoor_unit', 'Unité extérieure posée', 'apres', 500, 'compliant', now()),
  ('97000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
   '96000000-0000-4000-8000-000000000001', 'controller', 'Régulateur', 'apres', 900, 'missing', now());

-- Préférences : chacun règle les siennes ---------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated"}';
select lives_ok(
  $$update public.profiles set muted_alerts = '{jobsite_incomplete,inspection_failed}'
    where id = '91000000-0000-4000-8000-000000000004'$$,
  'le chef coupe deux alertes');
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$update public.profiles set email = 'dirigeant@exemple.fr', muted_alerts = '{inspection_failed,batch_threshold}'
    where id = '91000000-0000-4000-8000-000000000001'$$,
  'le dirigeant donne son e-mail et tente de couper les alertes critiques');
select throws_ok(
  $$update public.profiles set email = 'pas-un-mail' where id = '91000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'adresse e-mail invalide refusée');

-- 1. Chantier terminé avec des preuves manquantes -------------------------------------------------
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated"}';
update public.jobsites set status = 'completed_by_installer' where id = '94000000-0000-4000-8000-000000000001';
reset role;
select is((select array_agg(p.role::text order by p.role) from public.notifications n join public.profiles p on p.id = n.recipient_id
  where n.kind = 'jobsite_incomplete'), array['owner']::text[],
  'chantier incomplet : le dirigeant est prévenu, pas le chef qui a coupé cette alerte');
select is((select payload ->> 'body' from public.notifications where kind = 'jobsite_incomplete'),
  'CH-L-1 : 1 preuve(s) manquante(s)', 'le message compte les preuves manquantes');

-- 2. Contrôles et lot -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$insert into public.cee_batches (id, operation_code, period_start, period_end)
    values ('95000000-0000-4000-8000-000000000001', 'BAR-TH-171', '2026-10-01', '2026-12-31')$$,
  'le bureau crée un lot');
select lives_ok(
  $$insert into public.inspections (jobsite_id, batch_id, kind, inspected_on, result)
    select '94000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'on_site', '2026-11-01', 'satisfactory'
    from generate_series(1, 5)$$,
  'le bureau saisit cinq contrôles satisfaisants');
select is((select alert_level from public.cee_batches where id = '95000000-0000-4000-8000-000000000001'), 'normal',
  'lot sans non-conformité : normal');
select lives_ok(
  $$insert into public.inspections (id, jobsite_id, batch_id, kind, inspected_on, result, findings)
    values ('98000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
            '95000000-0000-4000-8000-000000000001', 'on_site', '2026-11-02', 'unsatisfactory', 'Plaque illisible')$$,
  'un contrôle non satisfaisant est saisi');
reset role;
select is((select array_agg(p.role || ':' || n.kind || ':' || n.channel order by n.kind) from public.notifications n
  join public.profiles p on p.id = n.recipient_id where n.kind in ('inspection_failed', 'batch_threshold')),
  array['owner:batch_threshold:push_email', 'owner:inspection_failed:push']::text[],
  'contrôle non satisfaisant et lot au-dessus du seuil : le dirigeant est prévenu malgré ses préférences');
select is((select alert_level from public.cee_batches where id = '95000000-0000-4000-8000-000000000001'), 'over',
  '1 sur 6 (16,7 %) : au-dessus du seuil de 14 %');
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into public.inspections (jobsite_id, batch_id, kind, inspected_on, result)
  select '94000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'on_site', '2026-11-03', 'satisfactory'
  from generate_series(1, 2);
reset role;
select is((select alert_level || ':' || (select count(*) from public.notifications where kind = 'batch_threshold')
  from public.cee_batches where id = '95000000-0000-4000-8000-000000000001'), 'near:1',
  'la situation s''améliore (1 sur 8, 12,5 %) : proche du seuil, pas de nouvelle alerte');

-- 3. Reprise après contrôle -----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$select public.plan_correction('98000000-0000-4000-8000-000000000001', array['97000000-0000-4000-8000-000000000001']::uuid[])$$,
  '42501', null, 'le poseur ne planifie pas de reprise');
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(public.plan_correction('98000000-0000-4000-8000-000000000001',
  array['97000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000002']::uuid[]), 2,
  'le bureau planifie la reprise de deux preuves');
select is(public.plan_correction('98000000-0000-4000-8000-000000000001', array['97000000-0000-4000-8000-000000000001']::uuid[]), 1,
  'une seconde reprise de la même preuve');
reset role;
select is((select array_agg(item_key || ' | ' || instruction || ' | ' || status order by item_key) from public.proof_slots
  where item_key like '%~reprise-%'),
  array['controller~reprise-1 | Régulateur (après correction) | missing',
        'outdoor_unit~reprise-1 | Unité extérieure posée (après correction) | missing',
        'outdoor_unit~reprise-2 | Unité extérieure posée (après correction) | missing']::text[],
  'nouvelles preuves « après correction », numérotées ; les anciennes restent');
select is((select status from public.jobsites where id = '94000000-0000-4000-8000-000000000001'), 'in_progress',
  'le chantier repasse en cours');
select is((select count(*)::int from public.notifications n where n.kind = 'correction_planned'
  and n.recipient_id = '91000000-0000-4000-8000-000000000005'), 2, 'le poseur est prévenu');
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select public.plan_correction((select id from public.inspections where result = 'satisfactory' limit 1),
    array['97000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', null, 'pas de reprise sur un contrôle satisfaisant');
reset role;

-- 4. Récapitulatif du matin (dates relatives : le test ne dépend pas du jour où il tourne) ----
update public.proof_slots set status = 'to_retake' where id = '97000000-0000-4000-8000-000000000001';
update public.companies set rge_qualifications = jsonb_build_array(
  jsonb_build_object('organisme', 'Qualit''EnR', 'numero', 'QPAC/9', 'date_fin', current_date + 30),
  jsonb_build_object('numero', 'LOIN', 'date_fin', current_date + 400))
  where id = '90000000-0000-4000-8000-000000000001';
create temp table t_morning as
  select (date_trunc('day', now() at time zone 'Europe/Paris') + interval '3 days 8 hours 30 minutes')
         at time zone 'Europe/Paris' as at;
select is(app.daily_alerts((select at + interval '2 hours' from t_morning)), 0, 'en dehors de 8 h, rien');
select is(app.daily_alerts((select at from t_morning)), 2,
  '8 h 30 à Paris : photos orange depuis 48 h au bureau, RGE expirant au dirigeant');
select is((select array_agg(n.kind || ':' || n.channel || ':' || p.role order by n.kind) from public.notifications n
  join public.profiles p on p.id = n.recipient_id where n.kind in ('orange_overdue', 'rge_expiring')),
  array['orange_overdue:push:office', 'rge_expiring:email:owner']::text[],
  'sans e-mail, le bureau reçoit le récapitulatif en notification ; le dirigeant par e-mail');
select is(app.daily_alerts((select at + interval '1 day' from t_morning)), 1,
  'le lendemain : de nouveau les photos orange, mais pas une seconde alerte RGE');

select * from finish();
rollback;
