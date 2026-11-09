import { parseTemplate, planSlots, wordCount } from '@preuvio/shared';
import { describe, expect, it } from 'vitest';
import { globalTemplates } from './index';

describe.each(globalTemplates.map((t) => [(t as { code: string }).code, t]))('%s', (_, raw) => {
  const template = parseTemplate(raw);

  it('respecte le schéma (questions, conditions, répétitions)', () => {
    expect(template.items.length).toBeGreaterThan(3);
  });

  it('reste en brouillon tant qu’un professionnel ne l’a pas relu', () => {
    expect(['draft', 'reviewed']).toContain(template.review.status);
    if (template.review.status === 'reviewed') expect(template.review.reviewer).toBeTruthy();
  });

  it('a des consignes courtes (8 mots maximum)', () => {
    for (const item of template.items) {
      expect(wordCount(item.label)).toBeLessThanOrEqual(8);
      if (item.hint) expect(wordCount(item.hint)).toBeLessThanOrEqual(8);
    }
  });

  it('commence par l’avant et finit par l’après', () => {
    expect(template.items[0]!.phase).toBe('avant');
    expect(template.items.at(-1)!.phase).toBe('apres');
  });

  it('produit au moins une preuve obligatoire sans aucune réponse', () => {
    expect(
      planSlots(template, {}).filter((s) => s.applicable && s.required).length,
    ).toBeGreaterThan(0);
  });
});
