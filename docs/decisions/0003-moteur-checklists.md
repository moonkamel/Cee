# 0003 — Moteur de checklists : génération sur le téléphone, preuves masquées plutôt que supprimées

- **Date** : 9 novembre 2026 (session S8)
- **Statut** : adoptée (validée par le porteur du projet)
- **Spécification** : section 7 (format des modèles, questions rapides, « Impossible »),
  section 2 (écran récapitulatif de fin de chantier).

## Décisions

1. **Génération sur le téléphone.** Les modèles publiés (globaux et de l'entreprise) sont
   synchronisés en lecture seule. À la création rapide d'un chantier, l'opération et ses preuves
   sont générées en local puis envoyées par la file : la checklist existe même sans réseau.
   Code : `packages/shared/src/checklists`, `apps/mobile/src/data/local-source.ts`.
2. **Deux ajouts au format de la section 7**, validés par le schéma zod :
   - `show_if` accepte, pour une question numérique, un nombre exact ou une plage `{ gte, lte }` ;
   - `repeat: "<question numérique>"` crée une preuve par unité (« Unité intérieure posée (2) »).
3. **Une preuve écartée par une réponse est masquée** (`proof_slots.applicable = false`), jamais
   supprimée : ses éventuelles photos restent rattachées, et le score (S10) ne la compte pas.
   Tant qu'une question n'a pas de réponse, aucune preuve n'est masquée.
4. **« Impossible »** : un motif choisi dans une liste fixe (`WAIVER_REASONS`) ; la note vocale
   arrive avec le module 4. La dispense est validée par le bureau.
5. **Terminer avec des manques reste possible**, après un second tap et un avertissement : le
   poseur n'est jamais bloqué sur place ; le bureau voit le chantier « à risque ».
6. **Modèles globaux** : fichiers JSON dans `packages/templates`, publiés par une migration
   générée (`UPDATE_TEMPLATES_SQL=1 pnpm --filter @preuvio/templates test`). Une version publiée
   ne change plus : une correction est une nouvelle version. Les deux modèles V1 (PAC air/eau,
   combles perdus) sont **en brouillon** tant qu'un professionnel ne les a pas relus.
