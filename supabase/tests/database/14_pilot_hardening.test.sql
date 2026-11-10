-- Finitions avant pilote (S19) : plafond de SMS, effacement d'un client, journal d'audit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, aud, role, phone) values
  ('e1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '33639989501'),
  ('e1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '33639989502');
insert into public.companies (id, name, sms_daily_limit) values ('e1000000-0000-4000-8000-000000000001', 'Entreprise R', 2);
insert into public.profiles (id, company_id, role, full_name) values
  ('e1100000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'owner', 'Dirigeant R'),
  ('e1100000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'office', 'Bureau R');
insert into public.clients (id, company_id, full_name, phone, email, address) values
  ('e1300000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Mme Avec Chantier', '+33639989510', 'a@example.com', '1 rue A 44000 Nantes'),
  ('e1300000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'M. Sans Chantier', '+33639989511', 'b@example.com', '2 rue B 44000 Nantes');
insert into public.jobsites (id, company_id, client_id, address) values
  ('e1400000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000001', '1 rue A 44000 Nantes');
insert into public.share_links (id, company_id, jobsite_id, token_hash, expires_at) values
  ('e1500000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e1400000-0000-4000-8000-000000000001',
   repeat('e', 64), now() + interval '90 days');

-- SMS ------------------------------------------------------------------------------------------
select ok(public.sms_quota_take('e1000000-0000-4000-8000-000000000001'), '1er SMS du jour');
select ok(public.sms_quota_take('e1000000-0000-4000-8000-000000000001'), '2e SMS du jour');
select ok(not public.sms_quota_take('e1000000-0000-4000-8000-000000000001'), 'au-delà du plafond : refusé');
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1100000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.sms_quota_take('e1000000-0000-4000-8000-000000000001')$$, '42501', null,
  'le compteur est réservé au serveur');
select throws_ok($$update public.companies set sms_daily_limit = 999$$, '42501', null,
  'le plafond ne se change pas depuis le navigateur');

-- Effacement -----------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1100000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.erase_client('e1300000-0000-4000-8000-000000000002')$$, '42501', null,
  'effacement réservé à l''admin et au dirigeant');
set local request.jwt.claims = '{"sub":"e1100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.erase_client('e1300000-0000-4000-8000-000000000002'), 'efface', 'client sans chantier : effacé');
select is(public.erase_client('e1300000-0000-4000-8000-000000000001'), 'restreint',
  'client avec chantier : preuve conservée, accès restreint');
reset role;
select is((select full_name || ':' || coalesce(phone, '-') || ':' || coalesce(address, '-') from public.clients
           where id = 'e1300000-0000-4000-8000-000000000001'),
  'Mme Avec Chantier:-:1 rue A 44000 Nantes', 'nom et adresse du chantier gardés, téléphone effacé');
select ok((select revoked_at is not null from public.share_links where id = 'e1500000-0000-4000-8000-000000000001'),
  'liens personnels du client révoqués');
select ok(not exists (
  select 1 from public.audit_log
  where table_name = 'clients' and record_id in ('e1300000-0000-4000-8000-000000000001', 'e1300000-0000-4000-8000-000000000002')
    and (diff::text like '%+33639989510%' or diff::text like '%M. Sans Chantier%' or diff::text like '%b@example.com%')),
  'le journal d''audit ne garde plus les données effacées');

-- Santé ---------------------------------------------------------------------------------------
select is((public.queue_health() -> 'photo_analysis' ->> 'waiting')::int, 0, 'files lisibles par la supervision');
set local role anon;
select throws_ok($$select public.queue_health()$$, '42501', null, 'santé réservée au serveur');
reset role;

select * from finish();
rollback;
