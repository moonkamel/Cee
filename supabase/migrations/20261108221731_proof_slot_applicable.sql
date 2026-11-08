-- Moteur de checklists (section 7, S8) : une preuve masquée par une réponse (« Ancienne
-- chaudière déposée ? Non », moins d'unités intérieures) n'est ni affichée ni comptée.
-- Elle n'est jamais supprimée : ses éventuelles photos restent rattachées.
alter table public.proof_slots add column applicable boolean not null default true;
