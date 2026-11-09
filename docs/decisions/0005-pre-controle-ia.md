# 0005 — Pré-contrôle IA : file pgmq, fonction appelée chaque minute, verdict écrit par le serveur

- **Date** : 9 novembre 2026 (session S10)
- **Statut** : adoptée (validée par le porteur du projet ; quota de 200 analyses par jour)
- **Spécification** : section 8 (contrat de sortie, règles d'affichage, maîtrise des coûts,
  garde-fous), CLAUDE.md (interface remplaçable, claude-haiku-5-5 pour les photos).

## Décisions

1. **Interface remplaçable** (`packages/shared/src/ai`, point d'entrée `@preuvio/shared/ai`,
   jamais importé par l'appli mobile) : `PhotoAnalyzer`, verdict validé par zod, règles de
   décision pures. Implémentations : Claude (SDK officiel, sortie structurée, effort bas) et
   factice (tests, CI, démonstration). Les fichiers sont recopiés pour Deno dans
   `supabase/functions/_shared/ai`, et un test vérifie que la copie est à jour.
2. **Décision affichée** : vert si tout passe avec une confiance d'au moins 0,6 ; orange
   (« Reprendre » / « Garder quand même ») si un contrôle échoue avec assurance ; sinon le
   bureau vérifie, sans déranger le poseur. L'IA ne valide jamais un chantier.
3. **File** : une photo de preuve entre dans la file pgmq `photo_analysis` quand son empreinte
   est vérifiée (S7) ; sa preuve passe « en analyse ». Les photos libres sont « sans analyse »
   (classement groupé plus tard). pg_cron appelle `analyze-photos` chaque minute, seulement
   si la file n'est pas vide. Erreur passagère : le message réapparaît ; après 5 essais, la
   photo est « en échec » et le bureau tranche.
4. **Sécurité** : le verdict (`ai_status`, `ai_result`) et le statut « conforme » ne sont écrits
   que par le serveur (triggers) ; « Garder quand même » est une colonne à part
   (`photos.ai_kept_at`), qui ne s'annule pas. La fonction n'accepte que la clé de service.
5. **Quota** : `companies.ai_daily_quota` (200 par défaut), compté par jour (heure de Paris)
   dans `ai_usage` avec les jetons consommés. Quota atteint : la photo attend, le dépassement est
   noté (`quota_reached_at`, alerte interne).
6. **Image** : réduite à 1 500 px par la transformation d'images du stockage quand l'offre
   Supabase la propose ; sinon l'original s'il reste sous la limite de l'API, sinon le bureau.
7. **Jeu d'évaluation** : `pnpm --filter @preuvio/shared eval:ai fixtures/ai-eval` rejoue un
   dossier de photos annotées et compte fausses alertes et oublis, par contrôle et par modèle.

## Limites connues

- Aucune vraie photo annotée pour l'instant : le jeu d'évaluation est vide, à remplir pendant
  le test terrain. Le comportement du vrai modèle n'est donc pas encore mesuré.
- La transformation d'images n'est pas proposée par toutes les offres Supabase ; sans elle, une
  photo de plus de 3,7 Mo va directement au bureau.
- Un appel en échec passager consomme une unité de quota.
