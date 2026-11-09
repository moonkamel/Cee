// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { buildPdfData, companyColor, type PdfPhotoRow } from '../build';
import { ATKINSON_400, ATKINSON_700 } from '../fonts';
import { ReportDocument } from '../ReportDocument';

// Chantier d'exemple (docs/chantier-exemple.md), fin de chantier.
const photo = (
  id: string,
  at: string,
  instruction: string | null,
  extra: Partial<PdfPhotoRow> = {},
) => ({
  id,
  device_taken_at: at,
  server_received_at: at,
  lat: 47.161961,
  lng: -1.540204,
  gps_accuracy_m: 6,
  sha256: 'a'.repeat(64),
  caption: null,
  outside_geofence: false,
  ai_result: null,
  proof_slots: instruction ? { instruction } : null,
  ...extra,
});

async function sample(kind: 'completion' | 'dispute' = 'completion') {
  const verifyUrl = 'https://preuvio-web.vercel.app/verifier/r1';
  const png = await QRCode.toBuffer('photo', { type: 'png' });
  return buildPdfData({
    report: {
      id: 'r1',
      kind,
      version: 2,
      period: null,
      created_at: '2026-11-11T16:00:00Z',
      content: {
        kind,
        period: null,
        photo_ids: ['p2', 'p1', 'p3'],
        note_ids: ['n1'],
        sections: {
          summary: [
            { text: 'PAC posée et combles isolés.', photo_ids: ['p2', 'p1'], note_ids: ['n1'] },
          ],
          works: [{ text: 'Ajout du bureau.', photo_ids: [], note_ids: [] }],
          reserves: [],
          attention: [],
        },
        written_by: 'bureau',
        dropped: 0,
      },
    },
    jobsite: {
      reference: 'CH-2026-001',
      address: '14 Rue des Ajoncs 44400 Rezé',
      planned_start: '2026-11-09',
      planned_end: '2026-11-11',
      quote_reference: 'DEV-2026-0147',
      clients: { full_name: 'M. et Mme Guérin' },
      jobsite_operations: [{ code: 'BAR-TH-171', label: 'Pompe à chaleur air/eau' }],
      proof_slots: [
        {
          instruction: 'Régulateur après mise en service',
          required: true,
          applicable: true,
          status: 'missing',
          phase: 'apres',
          position: 900,
        },
        {
          instruction: 'Façade',
          required: true,
          applicable: true,
          status: 'compliant',
          phase: 'avant',
          position: 0,
        },
      ],
    },
    company: {
      name: 'Proofeo',
      siret: '12345678900011',
      address: null,
      brand_color: '#FFFF00',
      rge_qualifications: [
        { organisme: 'Qualit’EnR', numero: 'QPAC/1', domaines: ['PAC'] },
        { x: 1 },
      ],
    },
    photos: [
      photo('p1', '2026-11-09T15:00:00Z', 'Plaque de l’unité extérieure', {
        ai_result: {
          verdict: { extracted: { brand: 'Atlantic', model: 'Alféa', serial_number: 'SN1' } },
        },
      }),
      photo('p2', '2026-11-09T08:00:00Z', 'Façade du logement, numéro visible', {
        outside_geofence: true,
      }),
      photo('p3', '2026-11-10T09:00:00Z', null, { caption: 'Combles', lat: null, lng: null }),
    ],
    notes: [
      {
        id: 'n1',
        created_at: '2026-11-09T11:00:00Z',
        transcript: 'brut',
        transcript_clean: 'Il manque un raccord.',
      },
      { id: 'n2', created_at: '2026-11-09T12:00:00Z', transcript: null, transcript_clean: null },
    ],
    images: new Map([['p1', { data: png, format: 'png' as const }]]),
    logo: null,
    verifyUrl,
    qrDataUrl: await QRCode.toDataURL(verifyUrl),
    issuedAt: '2026-11-11T16:30:00Z',
  });
}

describe('données du PDF', () => {
  it('photos numérotées dans l’ordre de prise, phrases renvoyant aux numéros', async () => {
    const data = await sample();
    expect(data.photos.map((p) => [p.n, p.label])).toEqual([
      [1, 'Façade du logement, numéro visible'],
      [2, 'Plaque de l’unité extérieure'],
      [3, 'Combles'],
    ]);
    expect(data.sections[0]).toEqual({
      title: 'Résumé',
      sentences: [{ text: 'PAC posée et combles isolés.', photos: [1, 2], notes: [1] }],
    });
    expect(data.notes).toEqual([
      { n: 1, recordedAt: '2026-11-09T11:00:00Z', text: 'Il manque un raccord.' },
    ]);
    expect(data.equipment).toEqual([
      {
        label: 'Plaque de l’unité extérieure',
        brand: 'Atlantic',
        model: 'Alféa',
        serialNumber: 'SN1',
      },
    ]);
    expect(data.missing).toEqual(['Régulateur après mise en service']);
    expect(data.pv).toContain('PV de réception');
    expect(data.company.rge).toEqual(['Qualit’EnR QPAC/1 (PAC)']);
    expect(data.jobsite.dates).toBe('du 09/11/2026 au 11/11/2026');
    expect(data.photos[1]!.image).not.toBeNull();
  });

  it('dossier de litige : ni manques, ni équipements, ni PV', async () => {
    const data = await sample('dispute');
    expect(data.title).toBe('Dossier de litige');
    expect([data.missing, data.equipment, data.pv]).toEqual([null, [], null]);
  });

  it('une couleur d’entreprise illisible est remplacée par la couleur de marque', () => {
    expect(companyColor('#FFFF00')).toBe('#1F3A5F');
    expect(companyColor('#1E40AF')).toBe('#1E40AF');
    expect(companyColor(null)).toBe('#1F3A5F');
    expect(companyColor('rouge')).toBe('#1F3A5F');
  });
});

describe('rendu PDF', () => {
  it('produit un PDF avec texte accentué, photos, annexe et QR code', async () => {
    const pdf = await renderToBuffer(<ReportDocument data={await sample()} />);
    if (process.env.DUMP_PDF) writeFileSync(process.env.DUMP_PDF, pdf);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // Page de garde, une page de photos, une annexe.
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(3);
  }, 30_000);
});

describe('polices intégrées', () => {
  it('correspondent au paquet @fontsource', () => {
    const require = createRequire(import.meta.url);
    const file = (w: number) =>
      readFileSync(
        require.resolve(
          `@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff`,
        ),
      ).toString('base64');
    expect(ATKINSON_400).toBe(`data:font/woff;base64,${file(400)}`);
    expect(ATKINSON_700).toBe(`data:font/woff;base64,${file(700)}`);
  });
});
