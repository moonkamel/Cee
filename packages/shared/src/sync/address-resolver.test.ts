import { describe, expect, it } from 'vitest';
import { resolvePendingAddresses } from './address-resolver';
import { createSyncEngine } from './engine';
import { createFakeRemote } from './testing/fake-remote';
import { createNodeSqliteDb } from './testing/node-sqlite';

async function setup() {
  const server = createFakeRemote(() => Date.now());
  const engine = createSyncEngine({ db: createNodeSqliteDb(), remote: server.remote });
  await engine.init();
  await engine.write('jobsites', 'insert', {
    id: 'j1',
    address: 'Position GPS 45,7380 ; 4,9130 — adresse à compléter',
    lat: 45.738,
    lng: 4.913,
    _addressPending: true,
  });
  await engine.write('jobsites', 'insert', { id: 'j2', address: 'Déjà connue', lat: 45, lng: 4 });
  return { server, engine };
}

describe('resolvePendingAddresses', () => {
  it('complète l’adresse au retour du réseau et l’envoie au serveur', async () => {
    const { server, engine } = await setup();
    const asked: number[][] = [];
    const n = await resolvePendingAddresses(engine, async (lat, lng) => {
      asked.push([lat, lng]);
      return { label: '8 Allée des Tilleuls 69500 Bron', banId: '69029_x', lat, lng };
    });
    expect(n).toBe(1);
    expect(asked).toEqual([[45.738, 4.913]]);
    await engine.sync();
    expect(server.rows('jobsites').find((j) => j.id === 'j1')).toMatchObject({
      address: '8 Allée des Tilleuls 69500 Bron',
      ban_id: '69029_x',
    });
    const local = (await engine.rows('jobsites')).find((j) => j.id === 'j1');
    expect(local?._addressPending).toBe(false);
  });

  it('laisse le chantier en attente si le géocodeur échoue ou ne trouve rien', async () => {
    const { engine } = await setup();
    expect(await resolvePendingAddresses(engine, async () => null)).toBe(0);
    expect(
      await resolvePendingAddresses(engine, async () => {
        throw new Error('réseau');
      }),
    ).toBe(0);
    expect((await engine.rows('jobsites')).find((j) => j.id === 'j1')?._addressPending).toBe(true);
  });
});
