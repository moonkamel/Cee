# Preuvio — consignes pour Claude Code

## Le produit
Appli de preuve de pose pour entreprises RGE.
Spécification complète : docs/cahier-des-charges.md.
En cas de doute, la spécification fait foi : pose la question plutôt que d'inventer.
Chantier d'exemple de référence (données de démo, tests à la main) : docs/chantier-exemple.md.

## Utilisateur principal
Poseur sur chantier : gants, plein soleil, réseau faible, peu à l'aise avec le numérique.
Chaque écran mobile respecte les 8 principes de la section 1.

## Stack
- Monorepo pnpm + Turborepo
- apps/mobile : Expo, Expo Router, TypeScript strict, react-native-vision-camera
- apps/web : Next.js App Router, Tailwind, shadcn/ui
- supabase/ : Postgres, RLS, Storage, Edge Functions, pgmq
- packages/shared : logique métier pure, schémas zod, tests Vitest

## Règles
- Aucune clé d'API dans apps/mobile : tout appel externe passe par une Edge Function.
  Seule exception : la clé publique Supabase (« publishable »), faite pour être embarquée ;
  la RLS protège les données.
  Seconde exception : le géocodage de la Base Adresse Nationale (service public, sans clé).
- Écrans mobiles : données via l'interface DataSource (src/data), jamais Supabase en direct.
  Toute écriture passe par le moteur de synchronisation (packages/shared/src/sync) : local
  d'abord, puis file d'envoi. Voir docs/decisions/0001-synchronisation.md.
- Toute table a un company_id et une politique RLS testée. Seule exception : les entrées globales
  (company_id NULL) de checklist_templates et delegataires, maintenues par Preuvio.
- Références entre tables d'une entreprise : clés étrangères composites (id, company_id).
- Une photo n'est jamais modifiée ni supprimée physiquement.
- Couleurs et tailles uniquement via packages/ui-tokens.
- Textes d'interface en français, via les fichiers de traduction ; consignes de 8 mots maximum.
- Appels IA via packages/shared/ai (interface remplaçable) :
  claude-haiku-5-5 pour les photos, claude-sonnet-5-5 pour les rapports.
- Logique métier dans packages/shared, couverte à plus de 80 %.

## Méthode
1. Lire la section concernée, proposer un plan, attendre la validation.
2. Avancer par petites étapes, avec des tests.
3. Fin de session : pnpm lint, pnpm typecheck, pnpm test, puis résumé.

## Commandes
pnpm dev · pnpm test · pnpm lint · pnpm typecheck · supabase start · supabase db reset · supabase test db
Sans Docker : scripts/db-local/run-tests.sh (Postgres nu + imitation de Supabase, voir le script)
