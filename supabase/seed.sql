-- Données de démo (section 18, S3) : une entreprise, 3 utilisateurs, 3 chantiers dont le chantier
-- d'exemple de référence (docs/chantier-exemple.md).
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

-- Démonstration (S6, S8) : une opération PAC air/eau générée depuis le modèle global
-- (migration global_templates_v1), sur le chantier du poseur, sans réponse aux questions.
-- Mêmes preuves que planSlots(modèle, {}) de packages/shared.
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label)
select '61000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
       '50000000-0000-4000-8000-000000000001', t.cee_operation, t.id, t.version, t.content, t.title
from public.checklist_templates t
where t.company_id is null and t.code = 'PAC_AIR_EAU' and t.version = '1.0.0';

insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, position, required)
select v.id::uuid, '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
       '61000000-0000-4000-8000-000000000001', v.item_key, v.instruction, v.phase, v.position, v.required
from (values
  ('62000000-0000-4000-8000-000000000001', 'facade', 'Façade du logement, numéro visible', 'avant', 0, true),
  ('62000000-0000-4000-8000-000000000002', 'old_boiler', 'Ancienne chaudière avant dépose', 'avant', 100, true),
  ('62000000-0000-4000-8000-000000000003', 'old_boiler_plate', 'Plaque de l''ancienne chaudière', 'avant', 200, true),
  ('62000000-0000-4000-8000-000000000004', 'boiler_spot', 'Emplacement vide après dépose', 'pendant', 300, true),
  ('62000000-0000-4000-8000-000000000005', 'hydraulic', 'Raccordements hydrauliques avant habillage', 'pendant', 400, true),
  ('62000000-0000-4000-8000-000000000006', 'outdoor_unit', 'Unité extérieure posée, vue entière', 'apres', 500, true),
  ('62000000-0000-4000-8000-000000000007', 'outdoor_unit_plate', 'Plaque de l''unité extérieure', 'apres', 600, true),
  ('62000000-0000-4000-8000-000000000008', 'indoor_unit#1', 'Unité intérieure posée', 'apres', 701, true),
  ('62000000-0000-4000-8000-000000000009', 'indoor_unit_plate#1', 'Plaque de l''unité intérieure', 'apres', 801, true),
  ('62000000-0000-4000-8000-000000000010', 'controller', 'Régulateur après mise en service', 'apres', 900, true),
  ('62000000-0000-4000-8000-000000000011', 'commissioning_sheet', 'Fiche de mise en service', 'apres', 1000, false)
) as v(id, item_key, instruction, phase, position, required);

-- Chantier d'exemple de référence (docs/chantier-exemple.md) : M. et Mme Guérin, Rezé.
-- Pavillon de 1975 chauffé au fioul : PAC air/eau à la place de la chaudière, et soufflage
-- des combles perdus (maison et extension). Mêmes identifiants que sur le projet hébergé ;
-- ici en Thermi Rénov, créé par la dirigeante, affecté au poseur, du jour à J+2.
-- Preuves : planSlots(modèle, réponses) de packages/shared (vérifié par packages/templates).
insert into public.clients (id, company_id, full_name, phone, email, address, ban_id, lat, lng) values
  ('4308a777-bc85-4560-8858-2ad021c284ee', '20000000-0000-4000-8000-000000000001',
   'M. et Mme Guérin', '+33639980110', 'guerin.demo@example.com',
   '14 Rue des Ajoncs 44400 Rezé', '44143_0050_00014', 47.161961, -1.540204);

insert into public.jobsites (id, company_id, client_id, reference, address, ban_id, lat, lng, planned_start, planned_end,
                             status, quote_reference, work_types, created_by)
values
  ('7b382223-6e79-4bb9-9341-e2c164a215ed', '20000000-0000-4000-8000-000000000001', '4308a777-bc85-4560-8858-2ad021c284ee',
   'CH-2026-003', '14 Rue des Ajoncs 44400 Rezé', '44143_0050_00014', 47.161961, -1.540204,
   current_date, current_date + 2, 'planned', 'DEV-2026-0147', '{pac_air_eau,combles}',
   '10000000-0000-4000-8000-000000000001');

insert into public.jobsite_assignees (jobsite_id, profile_id, company_id) values
  ('7b382223-6e79-4bb9-9341-e2c164a215ed', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001');

-- Réponses issues de la visite technique : chaudière déposée, un module intérieur ;
-- deux zones de combles, trappe d'accès dans le logement.
insert into public.jobsite_operations (id, company_id, jobsite_id, code, template_id, template_version, template_snapshot, label, answers)
select v.id::uuid, '20000000-0000-4000-8000-000000000001', '7b382223-6e79-4bb9-9341-e2c164a215ed',
       t.cee_operation, t.id, t.version, t.content, t.title, v.answers::jsonb
from (values
  ('bd6b702e-e194-4ce9-ad3b-95a03005de21', 'PAC_AIR_EAU', '{"old_boiler_removed":true,"indoor_units":1}'),
  ('7c37abef-c22b-4467-95e8-7d5cb9aad697', 'COMBLES_PERDUS', '{"zones":2,"hatch_present":true}')
) as v(id, code, answers)
join public.checklist_templates t on t.company_id is null and t.code = v.code and t.version = '1.0.0';

insert into public.proof_slots (id, company_id, jobsite_id, operation_id, item_key, instruction, phase, position, required)
select v.id::uuid, '20000000-0000-4000-8000-000000000001', '7b382223-6e79-4bb9-9341-e2c164a215ed',
       v.operation_id::uuid, v.item_key, v.instruction, v.phase, v.position, v.required
from (values
  ('9141d077-8304-4c4d-8ed5-a9da734fae85', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'facade', 'Façade du logement, numéro visible', 'avant', 0, true),
  ('c1aae679-4593-45e2-8952-3f6ad5fcad81', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'old_boiler', 'Ancienne chaudière avant dépose', 'avant', 100, true),
  ('99a9a9ef-87d4-429c-a4b2-66ed6ac7a37f', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'old_boiler_plate', 'Plaque de l''ancienne chaudière', 'avant', 200, true),
  ('ce836b88-5ed1-4e65-8e74-177f320410ca', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'boiler_spot', 'Emplacement vide après dépose', 'pendant', 300, true),
  ('27299f76-4715-451c-b9de-e56c5beb231a', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'hydraulic', 'Raccordements hydrauliques avant habillage', 'pendant', 400, true),
  ('8e96e14a-d906-46bb-8536-e4b796b5b838', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'outdoor_unit', 'Unité extérieure posée, vue entière', 'apres', 500, true),
  ('1d2da0f8-8e53-415d-a77e-295f4be01203', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'outdoor_unit_plate', 'Plaque de l''unité extérieure', 'apres', 600, true),
  ('4ae11449-c875-47a4-8baa-1329297f2073', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'indoor_unit#1', 'Unité intérieure posée', 'apres', 701, true),
  ('d3b8f536-d37f-4558-b0d5-78983fc1680a', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'indoor_unit_plate#1', 'Plaque de l''unité intérieure', 'apres', 801, true),
  ('ecb832a7-54f6-4ce8-adbf-fd6bd8296fb1', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'controller', 'Régulateur après mise en service', 'apres', 900, true),
  ('079b19f2-6c60-4ece-a95e-876fa9f66e3a', 'bd6b702e-e194-4ce9-ad3b-95a03005de21', 'commissioning_sheet', 'Fiche de mise en service', 'apres', 1000, false),
  ('d7fae2b2-f681-4339-b6ad-33a11ed4e098', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'facade', 'Façade du logement, numéro visible', 'avant', 0, true),
  ('f3f77fec-7d20-4f7c-81c5-254d9ce0eaa3', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'attic_before#1', 'Combles avant travaux, vue large (1)', 'avant', 101, true),
  ('bb5fc593-fae6-41f7-8cb5-6f45b4b946c4', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'attic_before#2', 'Combles avant travaux, vue large (2)', 'avant', 102, true),
  ('a1bb4b69-cfac-48d5-8dee-e1c7df14988c', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'protections', 'Protection des spots et conduits', 'pendant', 200, true),
  ('3cfe0b0d-4d6c-4394-a395-a627722ba07d', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'insulation_label', 'Étiquette du sac d''isolant', 'pendant', 300, true),
  ('e3307ba0-5ac0-48f1-a09f-7faa62594e4c', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'attic_after#1', 'Combles isolés, vue large (1)', 'apres', 401, true),
  ('3101db6f-255d-47a1-8b94-34a652c81696', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'attic_after#2', 'Combles isolés, vue large (2)', 'apres', 402, true),
  ('02a66d5f-857c-42b5-a561-f720a8fed406', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'thickness#1', 'Épaisseur avec règle graduée visible (1)', 'apres', 501, true),
  ('8fdffa9e-f455-4ac8-8f51-3ad89267d0ea', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'thickness#2', 'Épaisseur avec règle graduée visible (2)', 'apres', 502, true),
  ('65c72640-6e54-4a21-8982-16974fc2670f', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'markers', 'Piges de repérage en place', 'apres', 600, true),
  ('531e7a57-1394-42c8-acd2-ef1a858b49bd', '7c37abef-c22b-4467-95e8-7d5cb9aad697', 'hatch', 'Trappe d''accès isolée et fermée', 'apres', 700, true)
) as v(id, operation_id, item_key, instruction, phase, position, required);
