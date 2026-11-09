# 0001 — Synchronisation hors ligne : file de modifications maison plutôt que PowerSync

- **Date** : 9 novembre 2026 (session S5)
- **Statut** : adoptée
- **Spécification** : section 4 (« Plan B si PowerSync ne convient pas : expo-sqlite et une file
  de modifications maison ») et section 20 (« Choix entre PowerSync et une file maison »).

## Décision

La base locale du téléphone est SQLite (expo-sqlite). Chaque écriture est faite d'abord en local,
puis mise dans une file d'envoi (`outbox`) rejouée dans l'ordre vers l'API Supabase, avec la
session de l'utilisateur. La réception récupère les lignes modifiées depuis le dernier passage,
avec un rafraîchissement complet toutes les 30 minutes.

Code : `packages/shared/src/sync` (moteur, testé avec une vraie base SQLite) et
`apps/mobile/src/data` (branchement dans l'appli).

## Raisons

1. **Une seule règle d'accès.** Avec PowerSync, les droits de lecture sont réécrits dans ses
   « sync rules », en double de la RLS (entreprise, équipe, rôle). Deux sources de vérité à
   garder identiques, pour la donnée la plus sensible du produit. Ici, toute lecture et toute
   écriture passent par l'API Supabase : la RLS testée (pgTAP) s'applique telle quelle.
2. **Aucun fournisseur de plus** : pas d'accès de réplication à la base, pas de données qui
   transitent par un tiers (RGPD, section 16).
3. **Volume adapté** : un poseur a quelques chantiers par jour ; un dirigeant quelques centaines.
4. **Testable de bout en bout** : le critère de S5 est vérifié en CI contre le vrai Supabase
   (`supabase.integration.test.ts`).

## Règles du moteur

- Identifiants générés sur le téléphone ; envoi idempotent (`on conflict do nothing`).
- File rejouée dans l'ordre ; après un échec réseau, attente croissante (5 s → 10 min max).
- Refus du serveur (droits, contrainte) : la modification est mise de côté (« refusée »), signalée
  à l'écran, sans bloquer le reste de la file.
- Une modification locale en attente n'est jamais écrasée par la réception.
- Champs commençant par `_` : locaux, jamais envoyés (ex. `_addressPending`).
- Déconnexion ou changement d'utilisateur : la base locale est effacée.

## À revoir si

- un dirigeant dépasse quelques milliers de chantiers synchronisés sur mobile ;
- l'édition simultanée d'une même ligne par plusieurs personnes devient courante (aujourd'hui :
  la dernière écriture reçue par le serveur l'emporte).
