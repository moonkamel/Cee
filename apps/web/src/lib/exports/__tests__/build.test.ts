// @vitest-environment node
import { sha256Hex } from '@preuvio/shared';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Faux client Supabase : chaque table renvoie ses lignes ; les écritures sont notées.
const tables: Record<string, unknown[]> = {};
const files: Record<string, Uint8Array> = {};
const updates: { table: string; values: Record<string, unknown> }[] = [];
const uploads: Record<string, Uint8Array> = {};

function query(table: string) {
  let pendingUpdate: Record<string, unknown> | null = null;
  const result = () => ({ data: tables[table] ?? [], error: null });
  const builder: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      if (pendingUpdate) updates.push({ table, values: pendingUpdate });
      return Promise.resolve(result()).then(ok, ko);
    },
    maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
    single: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
    update: (values: Record<string, unknown>) => {
      pendingUpdate = values;
      return builder;
    },
  };
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'returns', 'limit']) {
    builder[m] = () => builder;
  }
  return builder;
}

vi.mock('server-only', () => ({}));
vi.mock('../../supabase/server', () => ({
  supabaseServer: async () => ({
    from: query,
    storage: {
      from: () => ({
        download: async (path: string) =>
          files[path] ? { data: new Blob([files[path] as BlobPart]) } : { data: null },
        upload: async (path: string, bytes: Uint8Array) => {
          uploads[path] = bytes;
          return { error: null };
        },
      }),
    },
  }),
}));

const { buildExport } = await import('../build');

beforeEach(async () => {
  for (const k of Object.keys(updates)) delete updates[Number(k)];
  updates.length = 0;
  const jpeg = new Uint8Array(
    await sharp({ create: { width: 800, height: 600, channels: 3, background: '#557799' } })
      .jpeg()
      .toBuffer(),
  );
  Object.assign(files, {
    'c/p1.jpg': jpeg,
    'c/p2.jpg': jpeg,
    'c/devis.pdf': new TextEncoder().encode('%PDF-1.4 devis'),
  });
  const slot = (id: string, instruction: string, phase: string, status: string, code: string) => ({
    id,
    instruction,
    phase,
    position: 0,
    required: true,
    applicable: true,
    status,
    jobsite_operations: { code },
  });
  Object.assign(tables, {
    exports: [
      {
        id: 'e1',
        company_id: 'c',
        jobsite_ids: ['j1'],
        zip_path: null,
        delegataires: {
          name: 'Délégataire démo',
          naming_pattern: '{REF_CHANTIER}_{FICHE}_{ETAPE}_{N}.jpg',
        },
      },
    ],
    jobsites: [
      {
        id: 'j1',
        reference: 'CH-2026-001',
        address: '14 Rue des Ajoncs 44400 Rezé',
        planned_start: '2026-11-09',
        planned_end: '2026-11-11',
        quote_reference: 'DEV-2026-0147',
        clients: { full_name: 'M. et Mme Guérin' },
        jobsite_operations: [{ code: 'BAR-TH-171', label: 'Pompe à chaleur air/eau' }],
        proof_slots: [
          slot('s1', 'Façade du logement, numéro visible', 'avant', 'compliant', 'BAR-TH-171'),
          slot('s2', 'Plaque de l’unité extérieure', 'apres', 'compliant', 'BAR-TH-171'),
          slot('s3', 'Régulateur après mise en service', 'apres', 'missing', 'BAR-TH-171'),
        ],
        companies: {
          name: 'Proofeo',
          siret: null,
          address: null,
          brand_color: null,
          rge_qualifications: [],
          logo_path: null,
        },
      },
    ],
    photos: [
      {
        id: 'p1',
        proof_slot_id: 's1',
        author_id: 'u1',
        device_taken_at: '2026-11-09T08:00:00Z',
        server_received_at: '2026-11-09T08:01:00Z',
        lat: 47.16,
        lng: -1.54,
        gps_accuracy_m: 5,
        sha256: 'a'.repeat(64),
        caption: null,
        outside_geofence: false,
        ai_result: null,
        original_path: 'c/p1.jpg',
        thumbnail_path: null,
      },
      {
        id: 'p2',
        proof_slot_id: 's2',
        author_id: 'u1',
        device_taken_at: '2026-11-11T15:00:00Z',
        server_received_at: null,
        lat: null,
        lng: null,
        gps_accuracy_m: null,
        sha256: 'b'.repeat(64),
        caption: null,
        outside_geofence: false,
        ai_result: null,
        original_path: 'c/p2.jpg',
        thumbnail_path: null,
      },
    ],
    jobsite_documents: [
      { id: 'd1', kind: 'devis', file_path: 'c/devis.pdf', file_name: 'Devis signé.pdf' },
    ],
    profiles: [{ id: 'u1', full_name: 'Jean Poseur' }],
  });
});

describe('fabrication du ZIP d’un chantier', () => {
  it('contient la synthèse, les photos nommées et filigranées, les pièces, le CSV et le manifeste', async () => {
    expect(await buildExport('e1')).toEqual({ ok: true });
    const zip = uploads['c/exports/e1.zip']!;
    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual([
      'manifest.json',
      'metadonnees.csv',
      'photos/CH-2026-001_BAR-TH-171_APRES_01.jpg',
      'photos/CH-2026-001_BAR-TH-171_AVANT_01.jpg',
      'pieces/devis_1.pdf',
      'synthese.pdf',
    ]);
    // Copie filigranée : différente de l'original, qui reste intact dans le stockage.
    const copy = entries['photos/CH-2026-001_BAR-TH-171_AVANT_01.jpg']!;
    expect(Buffer.compare(Buffer.from(copy), Buffer.from(files['c/p1.jpg']!))).not.toBe(0);
    expect(new TextDecoder().decode(entries['synthese.pdf']!.subarray(0, 5))).toBe('%PDF-');
    const csv = new TextDecoder().decode(entries['metadonnees.csv']!);
    expect(csv).toContain('photos/CH-2026-001_BAR-TH-171_AVANT_01.jpg;09/11/2026;09:00:00');
    expect(csv).toContain('Jean Poseur');

    // Le manifeste couvre chaque autre fichier, avec la bonne empreinte.
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']!));
    expect(manifest.files).toHaveLength(5);
    for (const f of manifest.files as { path: string; sha256: string; size: number }[]) {
      expect(await sha256Hex(entries[f.path]!)).toBe(f.sha256);
      expect(entries[f.path]!.length).toBe(f.size);
    }

    const done = updates.find((u) => u.table === 'exports' && u.values.status === 'ready')!;
    expect(done.values).toMatchObject({ zip_path: 'c/exports/e1.zip', zip_size: zip.length });
    expect(done.values.zip_sha256).toBe(await sha256Hex(zip));
    expect(updates).toContainEqual({ table: 'jobsites', values: { status: 'exported' } });
  }, 60_000);

  it('photo pas encore envoyée : export en échec, rien de rangé', async () => {
    delete files['c/p2.jpg'];
    delete uploads['c/exports/e1.zip'];
    const result = await buildExport('e1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Photo pas encore envoyée');
    expect(uploads['c/exports/e1.zip']).toBeUndefined();
    expect(updates.at(-1)).toMatchObject({ table: 'exports', values: { status: 'failed' } });
  }, 60_000);
});
