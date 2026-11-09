// @vitest-environment node
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { textPath, watermark } from '../watermark';

describe('filigrane des copies d’export', () => {
  it('dessine le texte en tracés, sans police système', () => {
    const { d, width } = textPath('09/11/2026 16:10 · Rezé', 20, 1000);
    expect(d).toMatch(/^M/);
    expect(width).toBeGreaterThan(100);
    expect(textPath('x'.repeat(400), 20, 200).width).toBeLessThanOrEqual(200);
  });

  it('pose le bandeau en bas, dans le bon sens, sans toucher l’original', async () => {
    // Photo de téléphone en portrait : stockée couchée, avec l'orientation EXIF 6.
    const original = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#88aa66' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const copy = await watermark(
      new Uint8Array(original),
      '09/11/2026 16:10 · 14 Rue des Ajoncs · Proofeo',
    );
    if (process.env.DUMP_WATERMARK) writeFileSync(process.env.DUMP_WATERMARK, copy);
    const meta = await sharp(copy).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
    // Bas de l'image assombri par le bandeau, haut intact.
    const { data } = await sharp(copy).raw().toBuffer({ resolveWithObject: true });
    const lum = (y: number) => data[(y * 300 + 2) * 3]!;
    expect(lum(395)).toBeLessThan(lum(5));
    expect(Buffer.compare(original, copy)).not.toBe(0);
  });
});
