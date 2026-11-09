// Copie du pré-contrôle IA pour les Edge Functions (Deno) : les mêmes fichiers, imports en
// « .ts ». Un test vérifie que la copie est à jour (UPDATE_DENO_COPY=1 pour la réécrire).
export const DENO_COPY_FILES = [
  'verdict.ts',
  'prompt.ts',
  'analyzer.ts',
  'claude.ts',
  'fake.ts',
] as const;

export function toDeno(source: string, file: string): string {
  const body = source.replace(/from '(\.\/[^']+)'/g, (_, path: string) => `from '${path}.ts'`);
  return `// Généré depuis packages/shared/src/ai/${file} : ne pas modifier à la main.\n${body}`;
}
