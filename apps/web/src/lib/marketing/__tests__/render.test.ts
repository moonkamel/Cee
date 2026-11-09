// @vitest-environment node
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { blurRegions, composeVisual } from '../render';

/** Damier noir et blanc : un floutage efface le contraste. */
async function checker(width: number, height: number): Promise<Buffer> {
  const cells: string[] = [];
  for (let y = 0; y < height; y += 10)
    for (let x = 0; x < width; x += 10)
      if ((x + y) % 20 === 0) cells.push(`<rect x="${x}" y="${y}" width="10" height="10"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${cells.join('')}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

async function spread(img: Buffer, left: number, top: number, size: number) {
  const { data } = await sharp(img)
    .extract({ left, top, width: size, height: size })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Math.max(...data) - Math.min(...data);
}

describe('floutage', () => {
  it('efface la zone repérée, laisse le reste', async () => {
    const photo = await checker(400, 300);
    const out = await blurRegions(new Uint8Array(photo), [
      { kind: 'street_number', x: 0.5, y: 0.5, w: 0.25, h: 0.3 },
    ]);
    expect(await spread(out, 220, 160, 60)).toBeLessThan(120);
    expect(await spread(out, 20, 20, 60)).toBeGreaterThan(200);
  });

  it('sans zone : photo seulement redressée', async () => {
    const photo = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#888' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const meta = await sharp(await blurRegions(new Uint8Array(photo), [])).metadata();
    expect([meta.width, meta.height]).toEqual([30, 40]);
  });
});

describe('visuels', () => {
  it('carré 1 080 et vertical 1 080 × 1 920, avec logo et ville', async () => {
    const photo = await checker(400, 300);
    const logo = await sharp({
      create: { width: 200, height: 80, channels: 4, background: '#1E40AF' },
    })
      .png()
      .toBuffer();
    const input = {
      before: photo,
      after: photo,
      logo: new Uint8Array(logo),
      company: 'Proofeo',
      city: 'Rezé',
      color: '#1F3A5F',
    };
    const square = await composeVisual('square', input);
    const story = await composeVisual('story', { ...input, logo: new Uint8Array([1, 2, 3]) });
    if (process.env.DUMP_MARKETING) writeFileSync(process.env.DUMP_MARKETING, square);
    const [a, b] = await Promise.all([sharp(square).metadata(), sharp(story).metadata()]);
    expect([a.width, a.height, a.format]).toEqual([1080, 1080, 'jpeg']);
    expect([b.width, b.height]).toEqual([1080, 1920]);
  });
});
