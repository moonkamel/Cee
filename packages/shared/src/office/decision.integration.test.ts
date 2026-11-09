// Critère de fin de S12, contre le vrai Supabase (job CI « Base de données ») : le dirigeant
// tranche une photo orange, le poseur reçoit la demande de reprise (et sa notification).
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { applyDecision } from './apply';
import { retakeMessage } from './decision';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (process.env.REQUIRE_SUPABASE && (!url || !anonKey)) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY sont requis en CI');
}

const DIRIGEANT = { phone: '+33639980001', id: '10000000-0000-4000-8000-000000000001' };
const POSEUR = { phone: '+33639980003', id: '10000000-0000-4000-8000-000000000003' };
const DEMO_JOBSITE = '50000000-0000-4000-8000-000000000001';
const SLOT_HYDRAULIC = '62000000-0000-4000-8000-000000000005'; // « Raccordements hydrauliques… »

async function signIn(phone: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  const { error } = await client.auth.verifyOtp({ phone, token: '123456', type: 'sms' });
  if (error) throw new Error(`Connexion ${phone} impossible : ${error.message}`);
  return client;
}

describe.skipIf(!url || !anonKey)('décision du bureau contre Supabase', () => {
  it('« Demander une reprise » : le poseur reçoit la demande et la notification', async () => {
    const dirigeant = await signIn(DIRIGEANT.phone);
    const poseur = await signIn(POSEUR.phone);
    // La preuve est orange (l'IA a signalé un défaut).
    await poseur.from('proof_slots').update({ status: 'captured' }).eq('id', SLOT_HYDRAULIC);

    const message = retakeMessage('', 'Raccords flous, rapprochez-vous');
    expect(
      await applyDecision(
        dirigeant,
        {
          kind: 'retake',
          slotId: SLOT_HYDRAULIC,
          jobsiteId: DEMO_JOBSITE,
          recipientId: POSEUR.id,
          message,
        },
        DIRIGEANT.id,
      ),
    ).toEqual({ ok: true });

    const { data: requests } = await poseur
      .from('photo_requests')
      .select('proof_slot_id, message, status, requested_by')
      .eq('proof_slot_id', SLOT_HYDRAULIC)
      .eq('status', 'open');
    expect(requests).toEqual([
      { proof_slot_id: SLOT_HYDRAULIC, message, status: 'open', requested_by: DIRIGEANT.id },
    ]);
    const { data: slot } = await poseur
      .from('proof_slots')
      .select('status')
      .eq('id', SLOT_HYDRAULIC)
      .single();
    expect(slot?.status).toBe('to_retake');
    const { data: notifications } = await poseur
      .from('notifications')
      .select('kind, payload')
      .eq('kind', 'photo_request');
    expect(
      notifications?.some(
        (n) => (n.payload as { proof_slot_id?: string }).proof_slot_id === SLOT_HYDRAULIC,
      ),
    ).toBe(true);
  });

  it('le poseur ne peut pas trancher', async () => {
    const poseur = await signIn(POSEUR.phone);
    const result = await applyDecision(
      poseur,
      { kind: 'validate', slotId: SLOT_HYDRAULIC },
      POSEUR.id,
    );
    expect(result.ok).toBe(false);
  });
});
