-- Exports (section 11, S14) : pièces du chantier réservées au bureau, historique figé, ZIP définitif.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, aud, role, phone) values
  ('81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '33639988003'),
  ('81000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '33639988004'),
  ('81000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', '33639988009');
insert into public.companies (id, name) values
  ('80000000-0000-4000-8000-000000000001', 'Entreprise X'),
  ('80000000-0000-4000-8000-000000000002', 'Entreprise Y');
insert into public.profiles (id, company_id, role, full_name) values
  ('81000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000001', 'office', 'Bureau X'),
  ('81000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000001', 'lead', 'Chef X'),
  ('81000000-0000-4000-8000-000000000009', '80000000-0000-4000-8000-000000000002', 'owner', 'Dirigeant Y');
insert into public.jobsites (id, company_id, address) values
  ('84000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Chantier X'),
  ('84000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', 'Chantier Y');

-- Bureau ----------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$insert into public.jobsite_documents (id, jobsite_id, kind, file_path, file_name, document_date)
    values ('8d000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'devis',
            '80000000-0000-4000-8000-000000000001/pieces/devis.pdf', 'devis.pdf', '2026-10-05')$$,
  'le bureau ajoute le devis signé');
select is((select company_id::text || ':' || created_by::text from public.jobsite_documents
  where id = '8d000000-0000-4000-8000-000000000001'),
  '80000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000003',
  'entreprise et auteur posés par la base');
select lives_ok(
  $$update public.jobsite_documents set document_date = '2026-10-06', kind = 'offre_cee'
    where id = '8d000000-0000-4000-8000-000000000001'$$,
  'le bureau corrige le type ou la date');
select throws_ok(
  $$update public.jobsite_documents set file_path = 'autre.pdf' where id = '8d000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'le fichier d''une pièce ne change pas');
select throws_ok(
  $$insert into public.jobsite_documents (jobsite_id, kind, file_path, file_name)
    values ('84000000-0000-4000-8000-000000000002', 'devis', 'x.pdf', 'x.pdf')$$,
  null, null, 'pas de pièce sur le chantier d''une autre entreprise');
select lives_ok(
  $$insert into public.exports (id, jobsite_ids, checks, incomplete)
    values ('8e000000-0000-4000-8000-000000000001', array['84000000-0000-4000-8000-000000000001']::uuid[],
            '[{"key":"proofs","status":"ko"}]', true)$$,
  'le bureau lance un export, marqué incomplet');
select lives_ok(
  $$update public.exports set status = 'ready', zip_path = 'x/exports/1.zip', zip_sha256 = repeat('e', 64),
    zip_size = 10 where id = '8e000000-0000-4000-8000-000000000001'$$,
  'le ZIP rangé est attaché à l''export');
select throws_ok(
  $$update public.exports set zip_sha256 = repeat('f', 64) where id = '8e000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'le ZIP d''un export est définitif');
select throws_ok(
  $$update public.exports set incomplete = false where id = '8e000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'ce qui a été vérifié ne se réécrit pas');
select lives_ok(
  $$update public.exports set status = 'sent', sent_to = 'depot@delegataire.example', sent_at = now()
    where id = '8e000000-0000-4000-8000-000000000001'$$,
  'l''envoi est noté dans l''historique');

-- Chef d'équipe et autre entreprise --------------------------------------------------------------
set local request.jwt.claims = '{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.jobsite_documents), 0, 'le chef ne voit pas les pièces administratives');
select is((select count(*)::int from public.exports), 0, 'le chef ne voit pas les exports');
set local request.jwt.claims = '{"sub":"81000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.jobsite_documents) + (select count(*)::int from public.exports), 0,
  'une autre entreprise ne voit ni pièces ni exports');
reset role;
select throws_ok(
  $$delete from public.jobsite_documents where id = '8d000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'une pièce ne se supprime pas (retrait logique)');

select * from finish();
rollback;
