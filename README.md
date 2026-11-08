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

Configuration de l'appli mobile : copier `apps/mobile/.env.example` en `apps/mobile/.env.local`
(URL et clé publique Supabase, données par `pnpm exec supabase status`).

L'appli mobile tourne dans un **build de développement** (`expo-dev-client`), pas dans Expo Go :

```sh
cd apps/mobile
npx eas build --profile development --platform android   # ou ios
```

Base de données locale (Docker requis) :

```sh
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase test db    # tests pgTAP : isolement, rôles, intégrité
```

Sans Docker, avec un Postgres 16 local : `PGHOST=… PGPORT=… PGUSER=postgres scripts/db-local/run-tests.sh`.

Utilisateurs de démo (code SMS `123456` en local) : dirigeant `+33 6 39 98 00 01`,
chef d'équipe `+33 6 39 98 00 02`, poseur `+33 6 39 98 00 03`.

## Avancement

| Session | Contenu                            | État     |
| ------- | ---------------------------------- | -------- |
| S1      | Monorepo et outillage              | Terminée |
| S2      | Design system                      | Terminée |
| S3      | Base de données et sécurité        | Terminée |
| S4      | Connexion et écran « Aujourd'hui » | Terminée |
| S5      | Hors ligne et synchronisation      | Terminée |
| S6      | Caméra et checklist                | Terminée |
| S7      | Envoi des photos                   | Terminée |
| S8      | Moteur de checklists               | Terminée |

Le plan complet (19 sessions, 5 phases) est dans la section 18 du cahier des charges.
