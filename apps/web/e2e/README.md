# Parcours web de bout en bout

Contre un Supabase local (`supabase start`, données de `supabase/seed.sql`) et le tableau de bord
construit. La CI les lance à chaque modification (job « Parcours de bout en bout »).

```bash
eval "$(supabase status -o env)"
NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY pnpm --filter @preuvio/web build
NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY pnpm --filter @preuvio/web start &
E2E_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY pnpm --filter @preuvio/web e2e
```

Chaque page visitée passe un audit d'accessibilité axe (WCAG 2.1 AA : aucune violation grave).
La signature du PV n'a lieu qu'une fois par chantier : repartir d'une base neuve
(`supabase db reset`) pour rejouer la suite.
