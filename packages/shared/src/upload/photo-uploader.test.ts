import { beforeEach, describe, expect, it } from 'vitest';
import { buildPhotoRow } from '../photo';
import { createSyncEngine } from '../sync/engine';
import { createFakeRemote } from '../sync/testing/fake-remote';
import { createNodeSqliteDb } from '../sync/testing/node-sqlite';
import type { Row } from '../sync/types';
import {
  createPhotoUploader,
  photosToUpload,
  uploadBlock,
  type UploadConditions,
  type UploadTransport,
} from './photo-uploader';

let clock = Date.parse('2026-11-09T08:00:00Z');
const now = () => clock;

const GOOD: UploadConditions = {
  online: true,
  wifi: false,
  wifiOnly: false,
  batteryLevel: 0.8,
  charging: false,
};

/** Faux stockage : un « fichier » est son empreinte, ce qui suffit à simuler une corruption. */
function createFakeTransport(server: ReturnType<typeof createFakeRemote>) {
  const phone = new Map<string, string>();
  const storage = new Map<string, string>();
  const state = { online: true, corruptNext: false, uploads: 0 };
  const transport: UploadTransport = {
    async upload(path, uri) {
      if (!state.online) return 'retry';
      const bytes = phone.get(uri);
      if (bytes === undefined) return 'rejected';
      state.uploads += 1;
      if (storage.has(path)) return 'exists';
      storage.set(path, state.corruptNext ? 'abîmé' : bytes);
      state.corruptNext = false;
      return 'ok';
    },
    async verify(id) {
      if (!state.online) return 'retry';
      const row = server.rows('photos').find((p) => p.id === id);
      if (!row) return 'missing';
      const object = storage.get(String(row.original_path));
      if (object === undefined) return 'missing';
      if (object !== row.sha256) {
        storage.delete(String(row.original_path));
        return 'mismatch';
      }
      server.serverWrite('photos', { ...row, upload_status: 'verified' });
      return 'verified';
    },
    async deleteLocal(uri) {
      phone.delete(uri);
    },
  };
  return { transport, phone, storage, state };
}

let n = 0;
function photo(sha = String(++n).padStart(64, 'a')): Row {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const row = buildPhotoRow(
    {
      id,
      companyId: 'c1',
      jobsiteId: 'j1',
      authorId: 'u1',
      proofSlotId: null,
      takenAt: new Date(clock + n * 1000).toISOString(),
      position: null,
      headingDeg: null,
      deviceModel: null,
      appVersion: null,
      sha256: sha,
      source: 'camera',
      width: null,
      height: null,
    },
    { lat: null, lng: null, geofenceRadiusM: 150 },
  );
  return { ...row, _localUri: `file:///photos/${id}.jpg`, _thumbUri: `file:///t/${id}.jpg` };
}

async function setup(db = createNodeSqliteDb()) {
  const server = createFakeRemote(now);
  const engine = createSyncEngine({ db, remote: server.remote, now });
  await engine.init();
  const files = createFakeTransport(server);
  const uploader = createPhotoUploader({ engine, transport: files.transport, now });
  return { db, server, engine, files, uploader };
}

async function take(ctx: Awaited<ReturnType<typeof setup>>) {
  const row = photo();
  ctx.files.phone.set(String(row._localUri), String(row.sha256));
  await ctx.engine.write('photos', 'insert', row);
  return row;
}

const local = async (ctx: Awaited<ReturnType<typeof setup>>, id: unknown) =>
  (await ctx.engine.rows('photos')).find((p) => p.id === id)!;

beforeEach(() => {
  clock = Date.parse('2026-11-09T08:00:00Z');
});

describe('conditions d’envoi', () => {
  it('bloque hors ligne, hors Wi-Fi si demandé, et sous 15 % de batterie hors charge', () => {
    expect(uploadBlock(GOOD)).toBeNull();
    expect(uploadBlock({ ...GOOD, online: false })).toBe('offline');
    expect(uploadBlock({ ...GOOD, wifiOnly: true })).toBe('wifi');
    expect(uploadBlock({ ...GOOD, wifiOnly: true, wifi: true })).toBeNull();
    expect(uploadBlock({ ...GOOD, batteryLevel: 0.14 })).toBe('battery');
    expect(uploadBlock({ ...GOOD, batteryLevel: 0.14, charging: true })).toBeNull();
    expect(uploadBlock({ ...GOOD, batteryLevel: 0.15 })).toBeNull();
    expect(uploadBlock({ ...GOOD, batteryLevel: null })).toBeNull();
  });

  it('les données mobiles suffisent par défaut (Wi-Fi uniquement désactivé)', async () => {
    const ctx = await setup();
    await take(ctx);
    await ctx.engine.sync();
    const report = await ctx.uploader.run({ ...GOOD, wifi: false });
    expect(report).toMatchObject({ verified: 1, waiting: 0, blocked: null });
  });
});

describe('envoi d’une photo', () => {
  it('attend que la fiche soit sur le serveur, puis envoie, vérifie et libère le téléphone', async () => {
    const ctx = await setup();
    const row = await take(ctx);

    // Fiche pas encore envoyée : on ne touche pas au fichier.
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 0, waiting: 1 });
    expect(ctx.files.state.uploads).toBe(0);

    await ctx.engine.sync();
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 1, waiting: 0 });

    const after = await local(ctx, row.id);
    expect(after).toMatchObject({ _upload: 'verified', _localUri: null });
    expect(after._thumbUri).toBe(row._thumbUri); // la vignette reste pour l'affichage
    expect(ctx.files.phone.has(String(row._localUri))).toBe(false);
    expect(ctx.files.storage.get(String(row.original_path))).toBe(row.sha256);

    // Le statut « vérifié » vient du serveur, jamais du téléphone.
    await ctx.engine.sync();
    expect((await local(ctx, row.id)).upload_status).toBe('verified');
    expect((await ctx.engine.status()).pending).toBe(0);
  });

  it('envoie la plus ancienne d’abord', async () => {
    const ctx = await setup();
    const first = await take(ctx);
    const second = await take(ctx);
    const rows = await ctx.engine.rows('photos');
    expect(photosToUpload([...rows].reverse()).map((p) => p.id)).toEqual([first.id, second.id]);
  });

  it('coupure réseau : rien n’est supprimé, nouvel essai après le délai', async () => {
    const ctx = await setup();
    const row = await take(ctx);
    await ctx.engine.sync();
    ctx.files.state.online = false;

    const report = await ctx.uploader.run(GOOD);
    expect(report).toMatchObject({ verified: 0, failed: 1, waiting: 1, blocked: 'offline' });
    expect(ctx.files.phone.has(String(row._localUri))).toBe(true);

    ctx.files.state.online = true;
    // Délai d'attente pas écoulé : on patiente…
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 0, waiting: 1 });
    // … sauf retour du réseau signalé (force), ou délai écoulé.
    clock += 6_000;
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 1, waiting: 0 });
  });

  it('coupure entre l’envoi et le contrôle : contrôle repris sans renvoyer le fichier', async () => {
    const ctx = await setup();
    const row = await take(ctx);
    await ctx.engine.sync();
    const verify = ctx.files.transport.verify;
    ctx.files.transport.verify = async () => 'retry';

    await ctx.uploader.run(GOOD);
    expect((await local(ctx, row.id))._upload).toBe('uploaded');
    expect(ctx.files.phone.has(String(row._localUri))).toBe(true);

    ctx.files.transport.verify = verify;
    expect(await ctx.uploader.run(GOOD, { force: true })).toMatchObject({ verified: 1 });
    expect(ctx.files.state.uploads).toBe(1);
  });

  it('appli tuée puis relancée : la file reprend là où elle était', async () => {
    const db = createNodeSqliteDb();
    const first = await setup(db);
    const row = await take(first);
    await first.engine.sync();

    // Nouvelle instance sur la même base locale (relance de l'appli).
    const second = await setup(db);
    second.files.phone.set(String(row._localUri), String(row.sha256));
    // Le faux serveur est neuf : on y recopie la fiche reçue avant l'arrêt.
    second.server.serverWrite('photos', first.server.rows('photos')[0]!);
    expect(await second.uploader.waitingCount()).toBe(1);
    expect(await second.uploader.run(GOOD)).toMatchObject({ verified: 1, waiting: 0 });
  });

  it('fichier abîmé en route : le serveur le refuse, l’original intact est renvoyé', async () => {
    const ctx = await setup();
    const row = await take(ctx);
    await ctx.engine.sync();
    ctx.files.state.corruptNext = true;

    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 0, failed: 1, waiting: 1 });
    expect(ctx.files.phone.has(String(row._localUri))).toBe(true);
    expect((await local(ctx, row.id))._upload).toBe('todo');

    clock += 6_000;
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 1, waiting: 0 });
    expect(ctx.files.storage.get(String(row.original_path))).toBe(row.sha256);
  });

  it('envoi répété d’un fichier déjà présent : compté comme envoyé', async () => {
    const ctx = await setup();
    const row = await take(ctx);
    await ctx.engine.sync();
    ctx.files.storage.set(String(row.original_path), String(row.sha256));
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 1 });
  });

  it('batterie faible : rien n’est envoyé, la photo attend', async () => {
    const ctx = await setup();
    await take(ctx);
    await ctx.engine.sync();
    const report = await ctx.uploader.run({ ...GOOD, batteryLevel: 0.1 });
    expect(report).toMatchObject({ verified: 0, waiting: 1, blocked: 'battery' });
    expect(ctx.files.state.uploads).toBe(0);
    expect(await ctx.uploader.run({ ...GOOD, batteryLevel: 0.1, charging: true })).toMatchObject({
      verified: 1,
    });
  });

  it('Wi-Fi uniquement : attend le Wi-Fi', async () => {
    const ctx = await setup();
    await take(ctx);
    await ctx.engine.sync();
    expect(await ctx.uploader.run({ ...GOOD, wifiOnly: true })).toMatchObject({ blocked: 'wifi' });
    expect(ctx.files.state.uploads).toBe(0);
    expect(await ctx.uploader.run({ ...GOOD, wifiOnly: true, wifi: true })).toMatchObject({
      verified: 1,
    });
  });

  it('refus du stockage : la photo reste, les suivantes partent quand même', async () => {
    const ctx = await setup();
    const lost = await take(ctx);
    ctx.files.phone.delete(String(lost._localUri)); // lecture impossible → refus
    const ok = await take(ctx);
    await ctx.engine.sync();
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ verified: 1, failed: 1, waiting: 1 });
    expect((await local(ctx, ok.id))._localUri).toBeNull();
    expect((await local(ctx, lost.id))._localUri).toBe(lost._localUri);
  });

  it('un seul passage à la fois', async () => {
    const ctx = await setup();
    await take(ctx);
    await ctx.engine.sync();
    const [a, b] = await Promise.all([ctx.uploader.run(GOOD), ctx.uploader.run(GOOD)]);
    expect(a).toBe(b);
    expect(ctx.files.state.uploads).toBe(1);
  });
});

describe('moteur : isSynced', () => {
  it('faux tant que la fiche est en file, même refusée', async () => {
    const ctx = await setup();
    const row = await take(ctx);
    expect(await ctx.engine.isSynced('photos', String(row.id))).toBe(false);
    ctx.server.state.rejectTables.add('photos');
    await ctx.engine.sync();
    expect(await ctx.engine.isSynced('photos', String(row.id))).toBe(false);
  });
});
