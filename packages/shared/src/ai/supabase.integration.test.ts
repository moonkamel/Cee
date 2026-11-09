// Critère de fin de S10, contre le vrai Supabase (job CI « Base de données ») avec l'analyseur
// factice côté serveur (config.toml : AI_PROVIDER=fake) : une plaque passe en orange avec son
// message, une unité extérieure en vert. Ignoré sans SUPABASE_URL.
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildPhotoRow } from '../photo';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.REQUIRE_SUPABASE && (!url || !anonKey || !serviceKey)) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis en CI');
}

const POSEUR = { phone: '+33639980003', id: '10000000-0000-4000-8000-000000000003' };
const DEMO_COMPANY = '20000000-0000-4000-8000-000000000001';
const DEMO_JOBSITE = '50000000-0000-4000-8000-000000000001';
const SLOT_UNIT = '62000000-0000-4000-8000-000000000006'; // « Unité extérieure posée, vue entière »
const SLOT_PLATE = '62000000-0000-4000-8000-000000000007'; // « Plaque de l'unité extérieure »

async function signIn(phone: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  const { error } = await client.auth.verifyOtp({ phone, token: '123456', type: 'sms' });
  if (error) throw new Error(`Connexion ${phone} impossible : ${error.message}`);
  return client;
}

describe.skipIf(!url || !anonKey || !serviceKey)('pré-contrôle IA contre Supabase', () => {
  it('pastille verte pour l’unité, orange avec message pour la plaque', async () => {
    const poseur = await signIn(POSEUR.phone);

    const photos: Record<string, string> = {};
    for (const slot of [SLOT_UNIT, SLOT_PLATE]) {
      const bytes = new Uint8Array(randomBytes(32 * 1024));
      const row = buildPhotoRow(
        {
          id: randomUUID(),
          companyId: DEMO_COMPANY,
          jobsiteId: DEMO_JOBSITE,
          authorId: POSEUR.id,
          proofSlotId: slot,
          takenAt: new Date().toISOString(),
          position: null,
          headingDeg: null,
          deviceModel: 'test',
          appVersion: 'test',
          sha256: createHash('sha256').update(bytes).digest('hex'),
          source: 'camera',
          width: null,
          height: null,
        },
        { lat: null, lng: null, geofenceRadiusM: 150 },
      );
      expect((await poseur.from('photos').insert(row)).error).toBeNull();
      expect(
        (await poseur.from('proof_slots').update({ status: 'captured' }).eq('id', slot)).error,
      ).toBeNull();
      const up = await poseur.storage
        .from('photos')
        .upload(String(row.original_path), bytes, { contentType: 'image/jpeg' });
      expect(up.error).toBeNull();
      // Empreinte vérifiée par le serveur (S7) : la photo entre dans la file d'analyse.
      const verified = await poseur.functions.invoke('verify-photo', {
        body: { photo_id: row.id },
      });
      expect(verified.error).toBeNull();
      photos[slot] = String(row.id);
    }
    const queued = await poseur
      .from('proof_slots')
      .select('id, status')
      .in('id', [SLOT_UNIT, SLOT_PLATE]);
    expect(queued.data?.map((s) => s.status)).toEqual(['analyzing', 'analyzing']);

    // Ce que pg_cron fait chaque minute.
    const res = await fetch(`${url}/functions/v1/analyze-photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);

    const { data: slots } = await poseur
      .from('proof_slots')
      .select('id, status')
      .in('id', [SLOT_UNIT, SLOT_PLATE]);
    expect(Object.fromEntries(slots!.map((s) => [s.id, s.status]))).toEqual({
      [SLOT_UNIT]: 'compliant',
      [SLOT_PLATE]: 'to_retake',
    });
    const { data: plate } = await poseur
      .from('photos')
      .select('ai_status, ai_result')
      .eq('id', photos[SLOT_PLATE]!)
      .single();
    expect(plate).toMatchObject({
      ai_status: 'done',
      ai_result: { decision: { kind: 'retake', message: 'Plaque illisible, rapprochez-vous' } },
    });

    // « Garder quand même » : noté à part ; le verdict reste celui du serveur.
    const kept = await poseur
      .from('photos')
      .update({ ai_kept_at: new Date().toISOString() })
      .eq('id', photos[SLOT_PLATE]!);
    expect(kept.error).toBeNull();
    const forged = await poseur
      .from('photos')
      .update({ ai_status: 'skipped' })
      .eq('id', photos[SLOT_PLATE]!);
    expect(forged.error).not.toBeNull();
  });

  it('refuse un appel sans la clé de service', async () => {
    const res = await fetch(`${url}/functions/v1/analyze-photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });
});
