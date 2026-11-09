// Critère de fin de S7, contre le vrai Supabase (job CI « Base de données », avec l'Edge
// Function verify-photo) : la photo arrive, son empreinte est contrôlée par le serveur, et
// un fichier abîmé en route est refusé puis renvoyé. Ignoré sans SUPABASE_URL.
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildPhotoRow } from '../photo';
import { createSyncEngine } from '../sync/engine';
import { createSupabaseRemote } from '../sync/supabase-remote';
import { createNodeSqliteDb } from '../sync/testing/node-sqlite';
import { createPhotoUploader, type UploadConditions } from './photo-uploader';
import { createSupabaseUploadTransport } from './supabase-transport';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (process.env.REQUIRE_SUPABASE && (!url || !anonKey)) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY sont requis en CI');
}

const POSEUR = { phone: '+33639980003', id: '10000000-0000-4000-8000-000000000003' };
const DEMO_COMPANY = '20000000-0000-4000-8000-000000000001';
const DEMO_JOBSITE = '50000000-0000-4000-8000-000000000001';
const GOOD: UploadConditions = {
  online: true,
  wifi: true,
  wifiOnly: false,
  batteryLevel: 1,
  charging: false,
};

async function signIn(phone: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  const { error } = await client.auth.verifyOtp({ phone, token: '123456', type: 'sms' });
  if (error) throw new Error(`Connexion ${phone} impossible : ${error.message}`);
  return client;
}

async function scenario({ tamperFirstUpload }: { tamperFirstUpload: boolean }) {
  const poseur = await signIn(POSEUR.phone);
  const engine = createSyncEngine({
    db: createNodeSqliteDb(),
    remote: createSupabaseRemote(poseur),
  });
  await engine.init();

  // Faux JPEG : seule l'empreinte compte ici.
  const original = new Uint8Array(randomBytes(64 * 1024));
  const sha256 = createHash('sha256').update(original).digest('hex');
  const phone = new Map([['file:///original.jpg', original]]);
  let tamper = tamperFirstUpload;
  const transport = createSupabaseUploadTransport(poseur, {
    async read(uri) {
      const bytes = phone.get(uri);
      if (!bytes) throw new Error('fichier absent');
      if (!tamper) return bytes;
      tamper = false;
      const damaged = bytes.slice();
      damaged[0] = damaged[0]! ^ 0xff;
      return damaged;
    },
    async remove(uri) {
      phone.delete(uri);
    },
  });

  const id = randomUUID();
  const row = buildPhotoRow(
    {
      id,
      companyId: DEMO_COMPANY,
      jobsiteId: DEMO_JOBSITE,
      authorId: POSEUR.id,
      proofSlotId: null,
      takenAt: new Date().toISOString(),
      position: null,
      headingDeg: null,
      deviceModel: 'test',
      appVersion: 'test',
      sha256,
      source: 'camera',
      width: null,
      height: null,
    },
    { lat: null, lng: null, geofenceRadiusM: 150 },
  );
  await engine.write('photos', 'insert', { ...row, _localUri: 'file:///original.jpg' });
  expect(await engine.sync({ force: true })).toMatchObject({ pushed: 1, rejected: 0 });

  let clock = Date.now();
  const uploader = createPhotoUploader({ engine, transport, now: () => clock });
  const reports = [await uploader.run(GOOD)];
  if (tamperFirstUpload) {
    clock += 60_000;
    reports.push(await uploader.run(GOOD));
  }

  const { data } = await poseur.from('photos').select('upload_status').eq('id', id).single();
  return { reports, phone, status: data?.upload_status, poseur, path: String(row.original_path) };
}

describe.skipIf(!url || !anonKey)('envoi des photos contre Supabase', () => {
  it('photo envoyée, empreinte contrôlée par le serveur, original libéré', async () => {
    const { reports, phone, status } = await scenario({ tamperFirstUpload: false });
    expect(reports[0]).toMatchObject({ verified: 1, failed: 0, waiting: 0 });
    expect(status).toBe('verified');
    expect(phone.size).toBe(0);
  });

  it('fichier abîmé : refusé par le serveur, l’original reste et repart', async () => {
    const { reports, phone, status } = await scenario({ tamperFirstUpload: true });
    expect(reports[0]).toMatchObject({ verified: 0, failed: 1, waiting: 1 });
    expect(reports[1]).toMatchObject({ verified: 1, waiting: 0 });
    expect(status).toBe('verified');
    expect(phone.size).toBe(0);
  });

  it('un fichier déposé ne peut pas être écrasé', async () => {
    const { poseur, path } = await scenario({ tamperFirstUpload: false });
    const { error } = await poseur.storage
      .from('photos')
      .upload(path, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg', upsert: true });
    expect(error).not.toBeNull();
  });
});
