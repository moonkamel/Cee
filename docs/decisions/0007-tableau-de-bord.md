# 0007 — Tableau de bord web : connexion par SMS, décisions écrites avec la session, push Expo

- **Date** : 9 novembre 2026 (session S12)
- **Statut** : adoptée (validée par le porteur du projet)
- **Spécification** : sections 8 (règles d'affichage), 10 (score, états, lots) et 14 (tableau de
  bord, rôles, équipe, notifications).

## Décisions

1. **Connexion par code SMS**, comme l'appli : même compte, aucun mot de passe. Session Supabase
   en cookies (`@supabase/ssr`), rafraîchie par `src/proxy.ts` (convention Next 16).
2. **Toutes les lectures et écritures avec la session de l'utilisateur** : la RLS et les triggers
   restent la seule règle d'accès (le chef d'équipe voit son équipe, le bureau et le dirigeant
   tout ; trancher est réservé au chef, au bureau, à l'admin et au dirigeant). Aucune clé serveur
   dans l'appli web.
3. **Logique métier partagée** (`packages/shared/src/office`) : score et états d'un chantier,
   liste « À traiter » triée par gravité, décision (« Valider » ou « Demander une reprise »,
   message de 8 mots prérempli par l'IA), lots et seuil avec projection. `applyDecision` sert à
   l'appli web et au test de bout en bout.
4. **Demande de reprise** : `photo_requests` est synchronisée vers le téléphone (bandeau « Photo
   à reprendre » qui ouvre la caméra sur la bonne preuve) et close automatiquement par la nouvelle
   photo de la preuve (trigger).
5. **Push** : la demande crée une notification ; `send-push` (pg_cron, chaque minute) l'envoie par
   le service Expo aux jetons du destinataire (`push_tokens`, écrits par la file de
   synchronisation), en respectant les heures calmes 20 h – 7 h. **Inactif tant que l'appli n'est
   pas construite avec un projet Expo** : la demande arrive alors à la synchronisation.
6. **Carte** : fond IGN Plan (Géoplateforme, service public, sans clé), MapLibre.
7. **Couleurs** : les jetons de `@preuvio/ui-tokens` deviennent des variables `--pv-*`, reliées
   aux utilitaires Tailwind par `@theme inline` (la valeur `initial` utilisée jusqu'ici
   supprimait les couleurs au lieu de les déclarer).

## Pas encore fait

- Indicateurs par poseur et évolution hebdomadaire du taux de complétude (avec les lots, S15).
- E-mails et récapitulatif du dirigeant à 18 h 30 ; préférences d'alertes par utilisateur.
- Version résumée du tableau de bord dans l'appli mobile.
