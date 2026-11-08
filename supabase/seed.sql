-- Données de démo (section 18, S3) : une entreprise, 3 utilisateurs, 2 chantiers.
-- Numéros fictifs de la plage ARCEP 06 39 98 : code SMS fixe 123456 en local (config.toml).
-- Exécuté par `supabase db reset` ; le seed tourne sans utilisateur connecté (pas de contrôle de rôle).

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   '33639980001', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   '33639980002', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   '33639980003', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now());

-- Le service d'authentification refuse les jetons NULL sur les comptes créés en SQL.
update auth.users set
  confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = '',
  email_change_token_current = '', phone_change = '', phone_change_token = '', reauthentication_token = ''
where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
             '10000000-0000-4000-8000-000000000003');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true),
       'phone', now(), now(), now()
from auth.users u
where u.id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
               '10000000-0000-4000-8000-000000000003');

insert into public.companies (id, name, siret, address, rge_qualifications, brand_color, plan, trial_ends_at)
values ('20000000-0000-4000-8000-000000000001', 'Thermi Rénov (démo)', '12345678900011',
        '12 rue des Artisans, 69003 Lyon',
        '[{"organisme":"Qualit''EnR","numero":"QPAC/12345","domaines":["PAC"],"date_fin":"2027-12-31"}]',
        '#1F3A5F', 'trial', now() + interval '30 days');

insert into public.teams (id, company_id, name)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Équipe Lyon');

insert into public.profiles (id, company_id, team_id, role, full_name, phone) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', null,
   'owner', 'Claire Dirigeante', '+33639980001'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'lead', 'Karim Chef', '+33639980002'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'installer', 'Jean Poseur', '+33639980003');

insert into public.clients (id, company_id, full_name, phone, address, lat, lng) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'M. et Mme Martin', '+33639980101', '8 allée des Tilleuls, 69500 Bron', 45.7380, 4.9130),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
   'Mme Dupont', '+33639980102', '3 chemin du Moulin, 69290 Craponne', 45.7450, 4.7240);

insert into public.jobsites (id, company_id, client_id, reference, address, lat, lng, planned_start, planned_end, status, created_by)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'CH-2026-001', '8 allée des Tilleuls, 69500 Bron', 45.7380, 4.9130,
   current_date, current_date + 1, 'planned', '10000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   'CH-2026-002', '3 chemin du Moulin, 69290 Craponne', 45.7450, 4.7240,
   current_date, current_date, 'planned', '10000000-0000-4000-8000-000000000001');

-- Chantier 1 (PAC air/eau) : le poseur ; chantier 2 (isolation des combles) : le chef.
insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');

-- Caméra guidée (S6) : en attendant les vrais modèles de checklists (S8), une opération de
-- démonstration « PAC air/eau » et ses preuves sur le chantier du poseur. Contenu illustratif,
-- non relu par un professionnel : à remplacer par le modèle officiel en S8.
insert into public.checklist_templates (id, company_id, code, trade, version, title, cee_operation, content, published)
values ('60000000-0000-4000-8000-000000000001', null, 'DEMO_PAC_AIR_EAU', 'chauffage', '0.1.0',
        'PAC air/eau (démonstration)', 'BAR-TH-171', '{"demo": true, "items": []}', true);

insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label)
values ('61000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001', 'BAR-TH-171', '60000000-0000-4000-8000-000000000001',
        '0.1.0', '{"demo": true}', 'PAC air/eau');

insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, position, required)
select v.id::uuid, '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
       '61000000-0000-4000-8000-000000000001', v.item_key, v.instruction, v.phase, v.position, v.required
from (values
  ('62000000-0000-4000-8000-000000000001', 'old_boiler', 'Chaudière existante avant dépose', 'avant', 1, true),
  ('62000000-0000-4000-8000-000000000002', 'outdoor_unit', 'Unité extérieure posée, vue entière', 'apres', 1, true),
  ('62000000-0000-4000-8000-000000000003', 'outdoor_unit_plate', 'Plaque de l''unité extérieure, lisible', 'apres', 2, true),
  ('62000000-0000-4000-8000-000000000004', 'indoor_unit', 'Unité intérieure posée', 'apres', 3, true),
  ('62000000-0000-4000-8000-000000000005', 'controller', 'Régulateur après mise en service', 'apres', 4, true)
) as v(id, item_key, instruction, phase, position, required);
