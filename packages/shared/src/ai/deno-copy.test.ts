import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DENO_COPY_FILES, toDeno } from './deno-copy';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const DEST = fileURLToPath(new URL('../../../../supabase/functions/_shared/', import.meta.url));

describe('copie Deno du pré-contrôle IA', () => {
  it('ajoute l’extension aux imports relatifs', () => {
    expect(toDeno("import { a } from './verdict';\nimport z from 'zod';", 'x.ts')).toContain(
      "from './verdict.ts';\nimport z from 'zod';",
    );
  });

  it.each(DENO_COPY_FILES)('%s est à jour dans supabase/functions/_shared', (file) => {
    const expected = toDeno(readFileSync(SRC + file, 'utf8'), file);
    if (process.env.UPDATE_DENO_COPY) {
      mkdirSync(dirname(DEST + file), { recursive: true });
      writeFileSync(DEST + file, expected);
    }
    expect(readFileSync(DEST + file, 'utf8')).toBe(expected);
  });
});
