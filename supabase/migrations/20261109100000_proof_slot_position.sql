-- Preuvio — S6 : ordre des preuves dans leur modèle (caméra guidée, section 6).
-- La caméra propose les preuves dans l'ordre conseillé : phase (avant, pendant, après),
-- puis cette position, reprise de l'ordre des éléments du modèle de checklist (S8).

alter table public.proof_slots
  add column position integer not null default 0 check (position >= 0);
