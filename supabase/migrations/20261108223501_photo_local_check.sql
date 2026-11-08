-- Contrôle local d'une photo (section 8, S9), fait sur le téléphone sans réseau :
-- { "verdict": "ok|blurry|dark|overexposed|empty", "metrics": {…}, "ms": 42,
--   "kept": true|false|null }. « kept » : gardée malgré l'alerte (true) ou reprise (false,
-- la photo est alors retirée logiquement). Le bureau et le pré-contrôle IA (S10) s'en servent.
alter table public.photos add column local_check jsonb;
alter table public.photos add constraint photos_local_check_verdict check (
  local_check is null
  or local_check ->> 'verdict' in ('ok', 'blurry', 'dark', 'overexposed', 'empty')
);
