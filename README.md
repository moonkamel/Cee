# Preuvio

Appli de preuve de pose pour les entreprises RGE : le poseur documente un chantier conforme
en moins de 2 minutes, le dirigeant récupère un dossier prêt pour le délégataire CEE.

- Spécification complète : [docs/cahier-des-charges.md](docs/cahier-des-charges.md)
- Consignes pour Claude Code : [CLAUDE.md](CLAUDE.md)

## Structure

```
apps/mobile          appli Expo (poseur, chef d'équipe, dirigeant)
apps/web             Next.js : tableau de bord, exports, page client
packages/ui-tokens   couleurs, typographie, espacements partagés
packages/shared      types, schémas zod, logique métier pure et testée
packages/templates   modèles de checklists en JSON versionné
supabase/            config, migrations SQL et politiques RLS, Edge Functions
```

## Démarrer

Prérequis : Node 22 (voir `.nvmrc`) et pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm dev          # lance le mobile (Expo) et le web (Next.js)
pnpm lint
pnpm typecheck
pnpm test
```

L'appli mobile tourne dans un **build de développement** (`expo-dev-client`), pas dans Expo Go :

```sh
cd apps/mobile
npx eas build --profile development --platform android   # ou ios
```

Base de données locale (Docker requis) :

```sh
pnpm exec supabase start
pnpm exec supabase db reset
```

## Avancement

| Session | Contenu                     | État     |
| ------- | --------------------------- | -------- |
| S1      | Monorepo et outillage       | Terminée |
| S2      | Design system               | À faire  |
| S3      | Base de données et sécurité | À faire  |

Le plan complet (19 sessions, 5 phases) est dans la section 18 du cahier des charges.
