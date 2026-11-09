// Visuels avant/après (section 13) : floutage des zones repérées par l'IA sur la photo entière,
// puis mise en page carrée ou verticale, avec le logo, le nom de l'entreprise et la ville.
// Les originaux ne sont jamais modifiés : chaque visuel est un nouveau fichier.
import {
  bandText,
  type BlurRegion,
  type MarketingFormat,
  marketingLayout,
  regionPixels,
} from '@preuvio/shared';
import { palette } from '@preuvio/ui-tokens';
import sharp, { type OverlayOptions } from 'sharp';
import { textPath } from '../exports/watermark';

const light = palette('light');
const contrast = palette('contrast');

/**
 * Photo redressée (EXIF) dont chaque zone est pixélisée puis floutée : irréversible, et visible
 * au premier coup d'œil par le dirigeant qui valide.
 */
export async function blurRegions(photo: Uint8Array, regions: BlurRegion[]): Promise<Buffer> {
  const { data: oriented, info } = await sharp(photo)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  if (regions.length === 0) return oriented;
  const pieces = await Promise.all(
    regions.map(async (r) => {
      const px = regionPixels(r, info.width, info.height);
      const small = Math.max(3, Math.round(Math.min(px.width, px.height) / 10));
      const pixelated = await sharp(oriented)
        .extract(px)
        .resize(small, small, { fit: 'fill' })
        .resize(px.width, px.height, { fit: 'fill', kernel: 'nearest' })
        .toBuffer();
      const sigma = Math.max(4, Math.min(px.width, px.height) / 6);
      const input = await sharp(pixelated).blur(sigma).toBuffer();
      return { input, left: px.left, top: px.top };
    }),
  );
  return sharp(oriented).composite(pieces).toBuffer();
}

function label(text: string, size: number): { svg: Buffer; width: number; height: number } {
  const pad = Math.round(size * 0.4);
  const { d, width } = textPath(text, size, 600);
  const w = Math.round(width + 2 * pad);
  const h = Math.round(size * 1.5);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="100%" height="100%" rx="${pad}" fill="${contrast.bg}" fill-opacity="0.7"/>` +
      `<path transform="translate(${pad} ${Math.round((h - size) / 2)})" d="${d}" fill="${contrast.text}"/></svg>`,
  );
  return { svg, width: w, height: h };
}

export type VisualInput = {
  before: Buffer;
  after: Buffer;
  logo: Uint8Array | null;
  company: string;
  city: string | null;
  /** Couleur du bandeau : celle de l'entreprise si le texte blanc y reste lisible. */
  color: string;
};

/** Visuel JPEG 1 080 × 1 080 (carré) ou 1 080 × 1 920 (vertical). */
export async function composeVisual(format: MarketingFormat, input: VisualInput): Promise<Buffer> {
  const layout = marketingLayout(format);
  const fit = (photo: Buffer, box: { width: number; height: number }) =>
    sharp(photo)
      .resize(Math.round(box.width), Math.round(box.height), {
        fit: 'cover',
        position: 'attention',
      })
      .toBuffer();
  const [before, after] = await Promise.all([
    fit(input.before, layout.before),
    fit(input.after, layout.after),
  ]);
  const margin = Math.round(layout.labelSize * 0.5);
  const tags = [
    { box: layout.before, ...label('Avant', layout.labelSize) },
    { box: layout.after, ...label('Après', layout.labelSize) },
  ];

  // Bandeau : logo sur pastille claire à gauche, puis nom de l'entreprise et ville.
  const band = layout.band;
  const pad = Math.round(band.height * 0.18);
  const logoBox = band.height - 2 * pad;
  let textLeft = pad;
  const layers: OverlayOptions[] = [];
  if (input.logo) {
    try {
      const logo = await sharp(input.logo)
        .resize(logoBox - 16, logoBox - 16, { fit: 'contain', background: light.surface })
        .flatten({ background: light.surface })
        .extend({ top: 8, bottom: 8, left: 8, right: 8, background: light.surface })
        .png()
        .toBuffer();
      layers.push({ input: logo, left: band.left + pad, top: band.top + pad });
      textLeft = pad * 2 + logoBox;
    } catch {
      // Logo illisible : le bandeau garde le nom seul.
    }
  }
  const size = Math.round(band.height * 0.3);
  const { d } = textPath(bandText(input.company, input.city), size, band.width - textLeft - pad);
  const bandSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${band.width}" height="${band.height}">` +
      `<rect width="100%" height="100%" fill="${input.color}"/>` +
      `<path transform="translate(${textLeft} ${Math.round((band.height - size) / 2)})" d="${d}" fill="${light.surface}"/></svg>`,
  );

  return sharp({
    create: { width: layout.width, height: layout.height, channels: 3, background: light.surface },
  })
    .composite([
      { input: before, left: Math.round(layout.before.left), top: Math.round(layout.before.top) },
      { input: after, left: Math.round(layout.after.left), top: Math.round(layout.after.top) },
      ...tags.map((t) => ({
        input: t.svg,
        left: Math.round(t.box.left) + margin,
        top: Math.round(t.box.top) + margin,
      })),
      { input: bandSvg, left: band.left, top: band.top },
      ...layers,
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}
