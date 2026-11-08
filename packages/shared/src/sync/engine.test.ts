import { beforeEach, describe, expect, it } from 'vitest';
import { FULL_REFRESH_MS, backoffMs, createSyncEngine, rowId } from './engine';
import { buildQuickJobsite } from './quick-jobsite';
import { createFakeRemote } from './testing/fake-remote';
import { createNodeSqliteDb } from './testing/node-sqlite';

let clock = Date.parse('2026-11-09T08:00:00Z');
const now = () => clock;

async function setup() {
  const db = createNodeSqliteDb();
  const server = createFakeRemote(now);
  const engine = createSyncEngine({ db, remote: server.remote, now });
  await engine.init();
  return { db, server, engine };
}

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function quickJobsite(userId = 'u-poseur') {
  return buildQuickJobsite({
    address: {
      label: '8 allée des Tilleuls 69500 Bron',
      banId: '69029_x',
      lat: 45.738,
      lng: 4.913,
      pending: false,
    },
    workTypes: ['pac_air_eau'],
    client: { fullName: 'M. Martin', phone: '06 39 98 01 01' },
    today: '2026-11-09',
    userId,
    newId,
  });
}

async function writeQuick(
  engine: Awaited<ReturnType<typeof setup>>['engine'],
  rows = quickJobsite(),
) {
  if (rows.client) await engine.write('clients', 'insert', rows.client);
  await engine.write('jobsites', 'insert', rows.jobsite);
  await engine.write('jobsite_assignees', 'insert', rows.assignee);
  return rows;
}

beforeEach(() => {
  clock = Date.parse('2026-11-09T08:00:00Z');
});

describe('critère de S5 : chantier créé en mode avion, retrouvé sur le serveur', () => {
  it('reste en file hors ligne, puis arrive sur le serveur au retour du réseau', async () => {
    const { server, engine } = await setup();
    server.state.online = false;

    const rows = await writeQuick(engine);
    // L'écran voit le chantier tout de suite, sans réseau.
    expect((await engine.rows('jobsites')).map((j) => j.id)).toEqual([rows.jobsite.id]);

    const offline = await engine.sync();
    expect(offline.offline).toBe(true);
    expect((await engine.status()).pending).toBe(3);
    expect(server.rows('jobsites')).toHaveLength(0);

    server.state.online = true;
    const report = await engine.sync({ force: true });
    expect(report).toMatchObject({ pushed: 3, rejected: 0, offline: false });
    expect((await engine.status()).pending).toBe(0);
    expect(server.rows('jobsites').map((j) => j.id)).toEqual([rows.jobsite.id]);
    expect(server.rows('clients')).toHaveLength(1);
    expect(server.rows('jobsite_assignees')).toHaveLength(1);
  });

  it('envoie dans l’ordre : client, chantier, puis affectation', async () => {
    const { server, engine } = await setup();
    const order: string[] = [];
    const insert = server.remote.insert;
    server.remote.insert = async (t, row) => {
      order.push(t);
      return insert(t, row);
    };
    await writeQuick(engine);
    await engine.sync();
    expect(order).toEqual(['clients', 'jobsites', 'jobsite_assignees']);
  });

  it('ne crée pas de doublon si un envoi est rejoué', async () => {
    const { server, engine } = await setup();
    const rows = await writeQuick(engine);
    await engine.sync();
    await server.remote.insert('jobsites', rows.jobsite);
    expect(server.rows('jobsites')).toHaveLength(1);
  });
});

describe('file d’envoi', () => {
  it('attend de plus en plus longtemps entre deux échecs, sans dépasser 10 minutes', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(20)).toBe(600_000);
  });

  it('respecte le délai d’attente, sauf synchronisation forcée', async () => {
    const { server, engine } = await setup();
    server.state.online = false;
    await writeQuick(engine);
    await engine.sync();
    server.state.online = true;
    server.state.calls = 0;

    const waiting = await engine.sync();
    expect(waiting.pushed).toBe(0);
    expect(server.state.calls).toBe(0);

    clock += 6_000;
    expect((await engine.sync()).pushed).toBe(3);
  });

  it('met de côté un refus du serveur sans bloquer le reste', async () => {
    const { server, engine } = await setup();
    server.state.rejectTables.add('clients');
    await writeQuick(engine);
    const report = await engine.sync();
    expect(report.rejected).toBe(1);
    expect(report.pushed).toBe(2);
    expect(await engine.status()).toMatchObject({ pending: 0, rejected: 1 });
    expect(await engine.rejectedItems()).toEqual([
      { table: 'clients', rowId: expect.any(String), op: 'insert', error: 'refusé' },
    ]);
  });

  it('n’envoie que les champs serveur : les champs locaux « _ » restent sur le téléphone', async () => {
    const { server, engine } = await setup();
    const rows = buildQuickJobsite({
      address: { label: 'Position GPS', banId: null, lat: 45.7, lng: 4.9, pending: true },
      workTypes: ['vmc'],
      client: null,
      today: '2026-11-09',
      userId: 'u',
      newId,
    });
    await engine.write('jobsites', 'insert', rows.jobsite);
    await engine.sync();
    expect(server.rows('jobsites')[0]).not.toHaveProperty('_addressPending');
    expect((await engine.rows('jobsites'))[0]).toMatchObject({ _addressPending: true });
  });

  it('envoie une modification après la création, et seulement les champs modifiés', async () => {
    const { server, engine } = await setup();
    const rows = await writeQuick(engine);
    await engine.write('jobsites', 'update', {
      id: rows.jobsite.id,
      address: '9 allée des Tilleuls 69500 Bron',
    });
    await engine.sync();
    expect(server.rows('jobsites')[0]).toMatchObject({
      address: '9 allée des Tilleuls 69500 Bron',
      work_types: ['pac_air_eau'],
    });
    expect((await engine.rows('jobsites'))[0]).toMatchObject({
      address: '9 allée des Tilleuls 69500 Bron',
    });
  });
});

describe('réception', () => {
  it('reçoit les chantiers créés par le bureau, avec les champs ajoutés par le serveur', async () => {
    const { server, engine } = await setup();
    server.serverWrite('jobsites', {
      id: 'j-bureau',
      address: 'Chantier du bureau',
      status: 'planned',
    });
    const report = await engine.sync();
    expect(report.pulled).toBe(1);
    expect((await engine.rows('jobsites'))[0]).toMatchObject({
      id: 'j-bureau',
      address: 'Chantier du bureau',
    });
  });

  it('ne réécrase pas une modification locale encore en attente', async () => {
    const { server, engine } = await setup();
    server.serverWrite('jobsites', { id: 'j1', address: 'Ancienne adresse' });
    await engine.sync();
    server.state.online = false;
    await engine.write('jobsites', 'update', { id: 'j1', address: 'Nouvelle adresse' });
    server.state.online = true;
    server.serverWrite('jobsites', { id: 'j1', address: 'Ancienne adresse' });
    // Le passage forcé envoie d'abord la modification, puis reçoit la version du serveur.
    await engine.sync({ force: true });
    expect((await engine.rows('jobsites'))[0]).toMatchObject({ address: 'Nouvelle adresse' });
  });

  it('retire au rafraîchissement complet un chantier qui n’est plus visible', async () => {
    const { server, engine } = await setup();
    server.serverWrite('jobsites', { id: 'j1', address: 'A' });
    server.serverWrite('jobsites', { id: 'j2', address: 'B' });
    await engine.sync();
    server.serverDelete('jobsites', { id: 'j2' });

    await engine.sync();
    expect(await engine.rows('jobsites')).toHaveLength(2); // pas encore de rafraîchissement complet

    clock += FULL_REFRESH_MS;
    await engine.sync();
    expect((await engine.rows('jobsites')).map((j) => j.id)).toEqual(['j1']);
  });

  it('ne reçoit ensuite que les lignes récentes (avec recouvrement)', async () => {
    const { server, engine } = await setup();
    server.serverWrite('jobsites', { id: 'j1', address: 'A' });
    await engine.sync();
    clock += 60 * 60_000;
    server.serverWrite('jobsites', { id: 'j2', address: 'B' });
    let seenSince: string | null | undefined;
    const pull = server.remote.pull;
    server.remote.pull = async (t, since) => {
      if (t === 'jobsites') seenSince = since;
      return pull(t, since);
    };
    clock -= 60 * 60_000 - 1; // reste sous le délai du rafraîchissement complet
    await engine.sync();
    expect(seenSince).toBe('2026-11-09T07:55:00.000Z');
  });

  it('marque l’appli hors ligne, et l’efface entièrement à la déconnexion', async () => {
    const { server, engine } = await setup();
    await writeQuick(engine);
    server.state.online = false;
    await engine.sync();
    expect((await engine.status()).offline).toBe(true);
    await engine.reset();
    expect(await engine.status()).toMatchObject({ pending: 0, offline: false, lastSyncAt: null });
    expect(await engine.rows('jobsites')).toHaveLength(0);
  });

  it('identifie une affectation par sa clé composée', () => {
    expect(rowId('jobsite_assignees', { jobsite_id: 'j', profile_id: 'p' })).toBe('j:p');
  });
});
