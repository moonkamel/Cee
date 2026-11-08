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
