// PDF du PV de réception (section 12), composé par le serveur au moment de la signature :
// gabarit fixe, aucun fichier fourni par le navigateur. Police standard Helvetica (accents
// français couverts par l'encodage WinAnsi).
import { PDFDocument, type PDFFont, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { MARKETING_CONSENT_LABEL, type PvContent } from '../_shared/client/index.ts';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.28, 0.33, 0.41);

/** Caractères hors WinAnsi remplacés (le PDF reste lisible quoi que tape le client). */
function winAnsi(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e -ÿ€•–—Œœ«»\n]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of winAnsi(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

const paris = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso));

export async function renderPv(pv: PvContent, signaturePng: Uint8Array, documentSha256: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${pv.title} ${pv.reference ?? ''}`.trim());
  doc.setAuthor(pv.company.name);
  const page = doc.addPage(A4);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = A4[0] - 2 * MARGIN;
  let y = A4[1] - MARGIN;

  const write = (
    text: string,
    opts: { size?: number; font?: PDFFont; color?: typeof INK; gap?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    const font = opts.font ?? regular;
    for (const line of wrap(text, font, size, width)) {
      page.drawText(line, { x: MARGIN, y: y - size, size, font, color: opts.color ?? INK });
      y -= size * 1.35;
    }
    y -= opts.gap ?? 6;
  };

  write(pv.company.name, { size: 14, font: bold, gap: 2 });
  const ident = [
    pv.company.siret ? `SIRET ${pv.company.siret}` : '',
    pv.company.rge.length ? `RGE : ${pv.company.rge.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (ident) write(ident, { size: 9, color: MUTED });
  y -= 10;
  write(pv.title, { size: 18, font: bold, gap: 12 });
  write(`Maître d'ouvrage : ${pv.client}`, { gap: 2 });
  write(`Adresse des travaux : ${pv.address}`, { gap: 2 });
  if (pv.reference) write(`Référence du chantier : ${pv.reference}`, { gap: 2 });
  y -= 6;
  write('Travaux réalisés', { font: bold, gap: 2 });
  for (const w of pv.works.length ? pv.works : ['Travaux du chantier ci-dessus'])
    write(`• ${w}`, { gap: 0 });
  y -= 10;
  write(pv.declaration, { font: bold, gap: 4 });
  if (pv.reserves) write(`Réserves : ${pv.reserves}`, { gap: 8 });
  write(
    `Fait le ${paris(pv.signedAt)}, par ${pv.signer}${pv.smsVerified ? ' (identité confirmée par code SMS)' : ''}.`,
  );
  if (pv.marketingConsent) {
    write(`Case cochée par le client : « ${MARKETING_CONSENT_LABEL} »`, {
      size: 9,
      color: MUTED,
    });
  }

  const img = await doc.embedPng(signaturePng);
  const scale = Math.min(220 / img.width, 90 / img.height, 1);
  page.drawText('Signature', { x: MARGIN, y: y - 12, size: 10, font: bold, color: INK });
  page.drawImage(img, {
    x: MARGIN,
    y: y - 20 - img.height * scale,
    width: img.width * scale,
    height: img.height * scale,
  });

  const foot = [
    'Signature électronique simple (règlement eIDAS). Nom, date, adresse IP et navigateur du signataire enregistrés.',
    `Empreinte SHA-256 du contenu signé : ${documentSha256}`,
  ];
  let fy = MARGIN + 14;
  for (const line of foot.reverse()) {
    page.drawText(winAnsi(line), { x: MARGIN, y: fy, size: 7, font: regular, color: MUTED });
    fy += 10;
  }
  return await doc.save();
}
