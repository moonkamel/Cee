import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { globalTemplatesSql, templateId } from './sql';

const MIGRATION = fileURLToPath(
  new URL('../../../supabase/migrations/20261108221805_global_templates_v1.sql', import.meta.url),
);

describe('migration des modèles globaux', () => {
  it('identifiants stables, au format UUID', () => {
    expect(templateId('PAC_AIR_EAU', '1.0.0')).toBe(templateId('PAC_AIR_EAU', '1.0.0'));
    expect(templateId('PAC_AIR_EAU', '1.0.0')).not.toBe(templateId('PAC_AIR_EAU', '1.0.1'));
    expect(templateId('X', '1.0.0')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('correspond aux fichiers JSON', () => {
    if (process.env.UPDATE_TEMPLATES_SQL) writeFileSync(MIGRATION, globalTemplatesSql());
    expect(readFileSync(MIGRATION, 'utf8')).toBe(globalTemplatesSql());
  });
});

describe('données de démonstration (supabase/seed.sql)', () => {
  it('les preuves de démonstration sont celles du modèle PAC, sans réponse', async () => {
    const { parseTemplate, planSlots } = await import('@preuvio/shared');
    const { globalTemplates } = await import('./index');
    const seed = readFileSync(
      fileURLToPath(new URL('../../../supabase/seed.sql', import.meta.url)),
      'utf8',
    );
    const pac = parseTemplate(
      globalTemplates.find((t) => (t as { code: string }).code === 'PAC_AIR_EAU'),
    );
    const expected = planSlots(pac, {}).map((p) => [
      p.itemKey,
      p.instruction,
      p.phase,
      p.position,
      p.required,
    ]);
    const rows = [
      ...seed.matchAll(
        /\('62000000-[^']+', '([^']+)', '((?:[^']|'')+)', '(\w+)', (\d+), (true|false)\)/g,
      ),
    ].map((m) => [m[1], m[2]!.replaceAll("''", "'"), m[3], Number(m[4]), m[5] === 'true']);
    expect(rows).toEqual(expected);
  });
});
