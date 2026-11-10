// Copie pour les Edge Functions (Deno) des fichiers de packages/shared/src qu'elles utilisent :
// mêmes fichiers, imports en « .ts ». Un test vérifie que la copie est à jour
// (UPDATE_DENO_COPY=1 pour la réécrire). Chemins relatifs à src/ et à supabase/functions/_shared/.
export const DENO_COPY_FILES = [
  'ai/verdict.ts',
  'ai/prompt.ts',
  'ai/analyzer.ts',
  'ai/claude.ts',
  'ai/fake.ts',
  'ai/transcriber.ts',
  'ai/mistral.ts',
  'ai/note.ts',
  'ai/report-content.ts',
  'ai/report.ts',
  'ai/marketing.ts',
  'notify/push.ts',
  'client/index.ts',
  'marketing/index.ts',
  'billing/stripe.ts',
] as const;

export function toDeno(source: string, file: string): string {
  const body = source.replace(/from '(\.\/[^']+)'/g, (_, path: string) => `from '${path}.ts'`);
  return `// Généré depuis packages/shared/src/${file} : ne pas modifier à la main.\n${body}`;
}
