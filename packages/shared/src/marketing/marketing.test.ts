import { describe, expect, it } from 'vitest';
import {
  bandText,
  captionLeaks,
  cityOf,
  cleanCaption,
  isFormat,
  isTone,
  marketingEligible,
  marketingLayout,
  regionPixels,
  safeRegions,
  shareFileName,
} from '.';

// Chantier d'exemple (docs/chantier-exemple.md).
const address = '14 Rue des Ajoncs 44400 Rezé';

describe('ville affichée', () => {
  it('ce qui suit le code postal, jamais la rue', () => {
    expect(cityOf(address)).toBe('Rezé');
    expect(cityOf('3 allée Verte 44000 Nantes Cedex 2')).toBe('Nantes');
    expect(cityOf('Lieu-dit sans code')).toBeNull();
    expect(cityOf(null)).toBeNull();
  });
});

describe('légendes sans adresse', () => {
  const context = { address, client: 'M. et Mme Guérin' };
  it('la ville et les travaux sont permis', () => {
    expect(captionLeaks('Pompe à chaleur posée à Rezé.', context)).toBe(false);
  });
  it('rue, numéro, code postal ou nom du client : écartée', () => {
    expect(captionLeaks('Chantier rue des Ajoncs terminé', context)).toBe(true);
    expect(captionLeaks('Au 14 rue, la PAC tourne', context)).toBe(true);
    expect(captionLeaks('Rezé (44400)', context)).toBe(true);
    expect(captionLeaks('Merci à la famille Guerin !', context)).toBe(true);
    expect(captionLeaks('Merci !', { address: 'Lieu-dit', client: null })).toBe(false);
  });
  it('nettoyée et bornée', () => {
    expect(cleanCaption('  a \n b ')).toBe('a b');
    expect(cleanCaption('abcdef', 4)).toBe('abc…');
  });
});

describe('chantier terminé et conforme', () => {
  const slot = (status: string, required = true, applicable = true) => ({
    status,
    required,
    applicable,
  });
  const base = {
    jobsiteStatus: 'completed_by_installer',
    slots: [slot('compliant'), slot('manually_validated'), slot('waived'), slot('missing', false)],
    marketingConsent: true,
  };
  it('preuves exigées validées, consentement coché, chantier terminé', () => {
    expect(marketingEligible(base)).toBe(true);
    expect(marketingEligible({ ...base, jobsiteStatus: 'exported' })).toBe(true);
  });
  it('sans consentement, en cours ou une preuve exigée manquante : rien', () => {
    expect(marketingEligible({ ...base, marketingConsent: false })).toBe(false);
    expect(marketingEligible({ ...base, jobsiteStatus: 'in_progress' })).toBe(false);
    expect(marketingEligible({ ...base, slots: [...base.slots, slot('to_retake')] })).toBe(false);
    expect(
      marketingEligible({ ...base, slots: [...base.slots, slot('missing', true, false)] }),
    ).toBe(true);
  });
});

describe('zones à flouter', () => {
  it('élargies, bornées à la photo ; zones invalides écartées', () => {
    expect(
      safeRegions([
        { kind: 'face', x: 0.9, y: 0, w: 0.2, h: 0.1 },
        { kind: 'cat', x: 0, y: 0, w: 1, h: 1 },
        { kind: 'plate', x: 0.1, y: 0.1, w: 0, h: 0.1 },
        { kind: 'plate', x: 'a', y: 0.1, w: 0.1, h: 0.1 },
        { kind: 'plate', x: 2, y: 2, w: 0.1, h: 0.1 },
        null,
      ]),
    ).toEqual([{ kind: 'face', x: 0.85, y: 0, w: 0.15000000000000002, h: 0.125 }]);
    expect(
      safeRegions(Array.from({ length: 30 }, () => ({ kind: 'face', x: 0, y: 0, w: 0.1, h: 0.1 }))),
    ).toHaveLength(20);
  });
  it('pixels entiers, jamais hors de l’image ni vides', () => {
    expect(regionPixels({ kind: 'face', x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, 100, 80)).toEqual({
      left: 50,
      top: 40,
      width: 25,
      height: 20,
    });
    expect(regionPixels({ kind: 'face', x: 1, y: 1, w: 0, h: 0 }, 100, 80)).toEqual({
      left: 99,
      top: 79,
      width: 1,
      height: 1,
    });
  });
});

describe('mise en page', () => {
  it('carré : côte à côte ; vertical : l’un sous l’autre ; bandeau en bas', () => {
    const square = marketingLayout('square');
    expect(square.width).toBe(1080);
    expect(square.before.left + square.before.width).toBeLessThan(square.after.left);
    expect(square.band.top + square.band.height).toBe(1080);
    const story = marketingLayout('story');
    expect(story.height).toBe(1920);
    expect(story.before.top + story.before.height).toBeLessThan(story.after.top);
    expect(story.after.top + story.after.height).toBeLessThanOrEqual(story.band.top);
  });
  it('bandeau, nom de fichier, gardes de type', () => {
    expect(bandText('Proofeo', 'Rezé')).toBe('Proofeo · Rezé');
    expect(bandText('Proofeo', null)).toBe('Proofeo');
    expect(shareFileName('Énergie & Fils', 'story')).toBe('energie-fils-avant-apres-vertical.jpg');
    expect(shareFileName('!!', 'square')).toBe('realisation-avant-apres-carre.jpg');
    expect([isTone('sobre'), isTone('drôle'), isFormat('story'), isFormat('a4')]).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });
});
