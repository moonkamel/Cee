// Calibrage des seuils du contrôle local (S9) sur le jeu de test généré, puis sur les vraies
// photos déposées dans fixtures/photo-quality (voir son README).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import { analyzePhoto, QUALITY_THRESHOLDS } from './analyze';
import { SCENES, testImage, VARIANTS, type Expected } from './testing/scenes';

describe('jeu de test généré', () => {
  const cases = SCENES.flatMap((kind) =>
    [1, 2].flatMap((seed) => VARIANTS.map((v) => ({ kind, seed, v }))),
  );
  const results = cases.map(({ kind, seed, v }) => ({
    name: `${kind}-${seed}-${v.name}`,
    expected: v.expected,
    result: analyzePhoto(testImage(kind, seed, v)),
  }));

  it.each(results.map((r) => [r.name, r.expected, r.result.verdict, r.result.metrics.sharpness]))(
    '%s : attendu %s',
    (_, expected, verdict) => {
      expect(verdict).toBe(expected);
    },
  );

  it('aucune fausse alerte sur une photo correcte (nette, douce, pénombre)', () => {
    const good = results.filter((r) => r.expected === 'ok');
    expect(good.filter((r) => r.result.verdict !== 'ok').map((r) => r.name)).toEqual([]);
  });

  it('le seuil de netteté laisse une marge des deux côtés', () => {
    const sharp = results.filter((r) => r.expected === 'ok').map((r) => r.result.metrics.sharpness);
    const blurry = results
      .filter((r) => r.expected === 'blurry')
      .map((r) => r.result.metrics.sharpness);
    expect(Math.min(...sharp)).toBeGreaterThan(QUALITY_THRESHOLDS.minSharpness);
    expect(Math.max(...blurry)).toBeLessThan(QUALITY_THRESHOLDS.minSharpness);
  });
});

// Vraies photos : le nom du fichier commence par le verdict attendu
// (ok-…, blurry-…, dark-…, overexposed-…, empty-…). Dossier vide : rien à vérifier.
const FIXTURES = fileURLToPath(new URL('../../fixtures/photo-quality/', import.meta.url));
const realPhotos = readdirSync(FIXTURES).filter((f) => /\.jpe?g$/i.test(f));

describe.skipIf(realPhotos.length === 0)('vraies photos de chantier', () => {
  it.each(realPhotos)('%s', (file) => {
    const expected = file.split('-')[0] as Expected;
    const decoded = jpeg.decode(readFileSync(FIXTURES + file), { useTArray: true });
    const { verdict } = analyzePhoto({
      data: decoded.data,
      width: decoded.width,
      height: decoded.height,
      format: 'RGBA',
    });
    expect(verdict).toBe(expected);
  });
});
