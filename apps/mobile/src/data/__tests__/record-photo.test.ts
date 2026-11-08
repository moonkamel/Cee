import type { Row, SyncedTable } from '@preuvio/shared';
import { createLocalSource } from '../local-source';

jest.mock('@/lib/position', () => ({ localToday: () => '2026-11-09' }));

/** Moteur minimal en mémoire : lignes par table et journal des écritures. */
function fakeEngine(initial: Partial<Record<SyncedTable, Row[]>>) {
  const tables = new Map<SyncedTable, Row[]>(Object.entries(initial) as [SyncedTable, Row[]][]);
  const writes: { table: SyncedTable; op: string; row: Row }[] = [];
  const engine = {
    rows: async (t: SyncedTable) => tables.get(t) ?? [],
    write: async (table: SyncedTable, op: 'insert' | 'update', row: Row) => {
      writes.push({ table, op, row });
    },
    sync: jest.fn(async () => ({ pushed: 0, rejected: 0, pulled: 0, offline: false })),
    status: async () => ({ pending: 0, rejected: 0, lastSyncAt: null, offline: false }),
    onChange: () => () => undefined,
    reset: async () => undefined,
  };
  return { engine, writes };
}

const input = {
  id: 'p1',
  jobsiteId: 'j1',
  proofSlotId: 's1',
  takenAt: '2026-11-09T09:15:00.000Z',
  position: { lat: 45.738, lng: 4.913, accuracyM: 6 },
  headingDeg: 182,
  sha256: 'c'.repeat(64),
  source: 'camera' as const,
  width: 4000,
  height: 3000,
  localUri: 'file:///doc/photos/p1.jpg',
  thumbUri: 'file:///doc/photos/p1.thumb.jpg',
};

describe('recordPhoto', () => {
  it('écrit la photo (fichier local gardé sur le téléphone) et passe la preuve « capturée »', async () => {
    const { engine, writes } = fakeEngine({
      profiles: [{ id: 'u1', company_id: 'c1' }],
      jobsites: [{ id: 'j1', lat: 45.738, lng: 4.913, geofence_radius_m: 150 }],
      proof_slots: [
        { id: 's1', jobsite_id: 'j1', status: 'missing', phase: 'apres', required: true },
      ],
    });
    const source = createLocalSource({
      engine: engine as never,
      currentUserId: () => 'u1',
      newId: () => 'x',
      deviceInfo: { model: 'Pixel 6a', appVersion: '1.0.0' },
    });
    await source.recordPhoto(input);

    expect(writes[0]).toMatchObject({
      table: 'photos',
      op: 'insert',
      row: {
        id: 'p1',
        author_id: 'u1',
        proof_slot_id: 's1',
        original_path: 'c1/j1/p1.jpg',
        device_model: 'Pixel 6a',
        app_version: '1.0.0',
        outside_geofence: false,
        _localUri: 'file:///doc/photos/p1.jpg',
        _thumbUri: 'file:///doc/photos/p1.thumb.jpg',
      },
    });
    expect(writes[1]).toEqual({
      table: 'proof_slots',
      op: 'update',
      row: { id: 's1', status: 'captured' },
    });
    expect(engine.sync).toHaveBeenCalled();
  });

  it('ne touche pas une preuve déjà validée (photo en plus sur le même emplacement)', async () => {
    const { engine, writes } = fakeEngine({
      profiles: [{ id: 'u1', company_id: 'c1' }],
      jobsites: [{ id: 'j1' }],
      proof_slots: [
        { id: 's1', jobsite_id: 'j1', status: 'compliant', phase: 'apres', required: true },
      ],
    });
    const source = createLocalSource({
      engine: engine as never,
      currentUserId: () => 'u1',
      newId: () => 'x',
    });
    await source.recordPhoto(input);
    expect(writes.map((w) => w.table)).toEqual(['photos']);
  });

  it('refuse sans profil synchronisé (entreprise inconnue)', async () => {
    const { engine } = fakeEngine({});
    const source = createLocalSource({
      engine: engine as never,
      currentUserId: () => 'u1',
      newId: () => 'x',
    });
    await expect(source.recordPhoto(input)).rejects.toThrow('Entreprise inconnue');
  });
});
