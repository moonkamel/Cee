import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import { analyzePhoto, judgeQuality, measureQuality, toLuma, type PixelImage } from './analyze';
import { testImage, VARIANTS } from './testing/scenes';

const variant = (name: string) => VARIANTS.find((v) => v.name === name)!;

function toFormat(img: PixelImage, format: 'RGBA' | 'BGRA' | 'ARGB'): PixelImage {
  const n = img.width * img.height;
  const out = new Uint8Array(n * 4);
  for (let p = 0; p < n; p += 1) {
    const [r, g, b] = [img.data[p * 3]!, img.data[p * 3 + 1]!, img.data[p * 3 + 2]!];
    const px =
      format === 'RGBA' ? [r, g, b, 255] : format === 'BGRA' ? [b, g, r, 255] : [255, r, g, b];
    out.set(px, p * 4);
  }
  return { data: out, width: img.width, height: img.height, format };
}

describe('contrôle local d’une photo', () => {
  it('même verdict quel que soit l’ordre des octets (Android RGBA, iOS BGRA)', () => {
    const img = testImage('plaque', 1, variant('nette'));
    const rgb = measureQuality(img);
    for (const f of ['RGBA', 'BGRA', 'ARGB'] as const) {
      expect(measureQuality(toFormat(img, f)).sharpness).toBeCloseTo(rgb.sharpness, 5);
    }
  });

  it('résiste à la compression JPEG de l’appareil', () => {
    for (const [name, expected] of [
      ['nette', 'ok'],
      ['floue', 'blurry'],
    ] as const) {
      const img = toFormat(testImage('chantier', 2, variant(name)), 'RGBA');
      const encoded = jpeg.encode({ data: img.data, width: img.width, height: img.height }, 80);
      const decoded = jpeg.decode(encoded.data, { useTArray: true });
      expect(
        analyzePhoto({
          data: decoded.data,
          width: decoded.width,
          height: decoded.height,
          format: 'RGBA',
        }).verdict,
      ).toBe(expected);
    }
  });

  it('ne dépend pas de la taille d’entrée (vignette ou image moyenne)', () => {
    const img = testImage('facade', 1, variant('nette'));
    const { width, height } = toLuma(img, 256);
    expect(Math.max(width, height)).toBe(256);
  });

  it('refuse des données incomplètes', () => {
    expect(() =>
      analyzePhoto({ data: new Uint8Array(10), width: 100, height: 100, format: 'RGBA' }),
    ).toThrow();
  });

  it('le défaut le plus grave l’emporte', () => {
    const base = { mean: 120, stdDev: 30, darkFraction: 0, brightFraction: 0, sharpness: 0.5 };
    expect(judgeQuality(base)).toBe('ok');
    expect(judgeQuality({ ...base, mean: 10, sharpness: 0 })).toBe('dark');
    expect(judgeQuality({ ...base, darkFraction: 0.9 })).toBe('dark');
    expect(judgeQuality({ ...base, brightFraction: 0.9, sharpness: 0 })).toBe('overexposed');
    expect(judgeQuality({ ...base, stdDev: 2, sharpness: 0 })).toBe('empty');
    expect(judgeQuality({ ...base, sharpness: 0.05 })).toBe('blurry');
  });

  it('analyse une image de 1024 px en bien moins de 300 ms', () => {
    const img = toFormat(testImage('chantier', 1, variant('nette')), 'RGBA');
    analyzePhoto(img); // échauffement
    const start = performance.now();
    analyzePhoto(img);
    const ms = performance.now() - start;
    console.info(`[qualité] analyse 1024 px : ${ms.toFixed(1)} ms`);
    // Node est plus rapide que Hermes : marge large, la durée réelle est mesurée sur téléphone.
    expect(ms).toBeLessThan(60);
  });
});
