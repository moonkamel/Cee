-- Preuvio — S5 : types de travaux prévus sur un chantier (création rapide, section 6).
-- Choisis par le poseur à la création ; la session S8 en tirera les opérations et leurs
-- emplacements de preuve à partir des modèles de checklists.
-- Valeurs identiques à WORK_TYPES (packages/shared/src/statuses.ts), vérifié par sql-sync.test.ts.

create domain public.work_type as text
  check (value in ('pac_air_eau', 'combles', 'murs', 'vmc', 'biomasse', 'menuiseries', 'photovoltaique'));

alter table public.jobsites
  add column work_types public.work_type[] not null default '{}';
