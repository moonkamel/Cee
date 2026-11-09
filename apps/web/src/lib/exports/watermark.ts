// Filigrane des copies d'export (section 6 : jamais sur l'original). Le texte est dessiné en
// tracés SVG avec la police Atkinson intégrée : la fonction serveur n'a pas de police système.
import * as fontkit from 'fontkit';
import { palette } from '@preuvio/ui-tokens';
import sharp from 'sharp';
import { ATKINSON_700 } from '../pdf/fonts';

// Bandeau en contraste maximal : lisible sur toutes les photos.
const ink = palette('contrast');

let font: fontkit.Font | null = null;
function atkinson(): fontkit.Font {
  if (!font) {
    const bytes = Buffer.from(ATKINSON_700.split(',')[1]!, 'base64');
    font = fontkit.create(bytes) as fontkit.Font;
  }
  return font;
}

/** Texte → tracé SVG (taille en pixels), et sa largeur ; le texte trop long est raccourci. */
export function textPath(
  text: string,
  size: number,
  maxWidth: number,
): { d: string; width: number } {
  const f = atkinson();
  const scale = size / f.unitsPerEm;
  let value = text;
  let run = f.layout(value);
  while (run.advanceWidth * scale > maxWidth && value.length > 4) {
    value = `${value.slice(0, -2).trimEnd()}…`;
    run = f.layout(value);
  }
  let x = 0;
  const parts: string[] = [];
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i]!;
    const path = glyph.path
      .scale(scale, -scale)
      .translate(x + pos.xOffset * scale, size * 0.8 - pos.yOffset * scale);
    parts.push(path.toSVG());
    x += pos.xAdvance * scale;
  });
  return { d: parts.join(' '), width: x };
}

/** Copie filigranée d'une photo JPEG : bandeau en bas, orientation corrigée, original intact. */
export async function watermark(original: Uint8Array, text: string): Promise<Buffer> {
  const image = sharp(original).rotate(); // applique l'orientation EXIF avant de poser le bandeau
  const meta = await image.metadata();
  const portrait = (meta.orientation ?? 1) >= 5;
  const width = (portrait ? meta.height : meta.width) ?? 1000;
  const height = (portrait ? meta.width : meta.height) ?? 750;
  const band = Math.max(28, Math.round(Math.min(width, height) * 0.05));
  const size = Math.round(band * 0.5);
  const pad = Math.round(band * 0.4);
  const { d } = textPath(text, size, width - 2 * pad);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${band}">` +
      `<rect width="100%" height="100%" fill="${ink.bg}" fill-opacity="0.55"/>` +
      `<path transform="translate(${pad} ${Math.round((band - size) / 2)})" d="${d}" fill="${ink.text}"/></svg>`,
  );
  return image
    .composite([{ input: svg, gravity: 'south' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
