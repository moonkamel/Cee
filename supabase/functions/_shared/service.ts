// Fonctions appelées par pg_cron avec la clé de service : vérification faite par la fonction.

/** Comparaison en temps constant d'une clé reçue. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Vrai si l'appel porte la clé de service du projet. */
export function isServiceCall(req: Request): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return key !== '' && sameSecret(req.headers.get('Authorization') ?? '', `Bearer ${key}`);
}
