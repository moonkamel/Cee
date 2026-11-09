// Critère de fin de S11, contre le vrai Supabase (job CI « Base de données ») avec les services
// factices côté serveur (AI_PROVIDER=fake) : une note envoyée est transcrite, nettoyée, et ce
// qu'elle signale (problème, matériel) apparaît pour le chantier. Ignoré sans SUPABASE_URL.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildVoiceNoteRow } from '../voice';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.REQUIRE_SUPABASE && (!url || !anonKey || !serviceKey)) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis en CI');
}

const POSEUR = { phone: '+33639980003', id: '10000000-0000-4000-8000-000000000003' };
const DEMO_COMPANY = '20000000-0000-4000-8000-000000000001';
const DEMO_JOBSITE = '50000000-0000-4000-8000-000000000001';

describe.skipIf(!url || !anonKey || !serviceKey)('notes vocales contre Supabase', () => {
  it('note envoyée, transcrite et nettoyée ; problème et matériel repérés', async () => {
    const poseur = createClient(url!, anonKey!, { auth: { persistSession: false } });
    await poseur.auth.signInWithOtp({ phone: POSEUR.phone, options: { shouldCreateUser: false } });
    expect(
      (await poseur.auth.verifyOtp({ phone: POSEUR.phone, token: '123456', type: 'sms' })).error,
    ).toBeNull();

    const row = buildVoiceNoteRow({
      id: randomUUID(),
      companyId: DEMO_COMPANY,
      jobsiteId: DEMO_JOBSITE,
      authorId: POSEUR.id,
      photoId: null,
      durationS: 9,
    });
    expect((await poseur.from('voice_notes').insert(row)).error).toBeNull();
    const up = await poseur.storage
      .from('voice-notes')
      .upload(String(row.audio_path), new Uint8Array(randomBytes(4096)), {
        contentType: 'audio/mp4',
      });
    expect(up.error).toBeNull();
    // Ce que fait la file d'envoi du téléphone une fois l'audio arrivé.
    expect(
      (
        await poseur
          .from('voice_notes')
          .update({ upload_status: 'uploaded' })
          .eq('id', row.id as string)
      ).error,
    ).toBeNull();

    // Ce que pg_cron fait chaque minute.
    const res = await fetch(`${url}/functions/v1/transcribe-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);

    const { data: note } = await poseur
      .from('voice_notes')
      .select('status, transcript, transcript_clean')
      .eq('id', row.id as string)
      .single();
    expect(note).toEqual({
      status: 'done',
      transcript: 'il manque un raccord, commander 2 coudes',
      transcript_clean: 'Il manque un raccord, commander 2 coudes.',
    });
    const { data: items } = await poseur
      .from('note_items')
      .select('kind, summary, quantity, status')
      .eq('voice_note_id', row.id as string)
      .order('kind');
    expect(items).toEqual([
      { kind: 'material', summary: 'coudes', quantity: 2, status: 'open' },
      { kind: 'problem', summary: 'Il manque un raccord', quantity: null, status: 'open' },
    ]);
  });
});
