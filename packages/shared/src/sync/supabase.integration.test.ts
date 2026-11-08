// Critère de fin de S5, contre le vrai Supabase (job CI « Base de données ») :
// un chantier créé hors ligne arrive sur le serveur au retour du réseau, avec les bons droits.
// Ignoré sans SUPABASE_URL / SUPABASE_ANON_KEY (exécution locale sans Supabase).
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSyncEngine } from './engine';
import { buildQuickJobsite } from './quick-jobsite';
import { createSupabaseRemote } from './supabase-remote';
import { createNodeSqliteDb } from './testing/node-sqlite';
import type { Remote } from './types';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

// En CI, un test ignoré faute de configuration ne doit jamais passer pour un succès.
if (process.env.CI && (!url || !anonKey)) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY sont requis en CI');
}

// Utilisateurs de démo de supabase/seed.sql (code SMS fixe en local).
const POSEUR = { phone: '+33639980003', id: '10000000-0000-4000-8000-000000000003' };
const DIRIGEANT = { phone: '+33639980001' };
const DEMO_COMPANY = '20000000-0000-4000-8000-000000000001';

async function signIn(phone: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  // Numéros de test (config.toml) : aucun SMS n'est envoyé, le code est fixe.
  await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  const { error } = await client.auth.verifyOtp({ phone, token: '123456', type: 'sms' });
  if (error) throw new Error(`Connexion ${phone} impossible : ${error.message}`);
  return client;
}

describe.skipIf(!url || !anonKey)('synchronisation contre Supabase', () => {
  it('chantier créé en mode avion, retrouvé sur le serveur après reconnexion', async () => {
    const poseur = await signIn(POSEUR.phone);
    const real = createSupabaseRemote(poseur);
    let online = false;
    const down = async () => ({
      ok: false as const,
      kind: 'retry' as const,
      message: 'mode avion',
    });
    const remote: Remote = {
      insert: (t, r) => (online ? real.insert(t, r) : down()),
      update: (t, k, p) => (online ? real.update(t, k, p) : down()),
      pull: (t, s) => (online ? real.pull(t, s) : down()),
    };
    const engine = createSyncEngine({ db: createNodeSqliteDb(), remote });
    await engine.init();

    const rows = buildQuickJobsite({
      address: {
        label: '12 rue de la Gare 69100 Villeurbanne',
        banId: null,
        lat: 45.77,
        lng: 4.88,
        pending: false,
      },
      workTypes: ['combles'],
      client: { fullName: 'M. Hors-Ligne', phone: '06 39 98 01 99' },
      today: new Date().toISOString().slice(0, 10),
      userId: POSEUR.id,
      newId: randomUUID,
    });
    await engine.write('clients', 'insert', rows.client!);
    await engine.write('jobsites', 'insert', rows.jobsite);
    await engine.write('jobsite_assignees', 'insert', rows.assignee);

    expect((await engine.sync()).offline).toBe(true);
    expect((await engine.status()).pending).toBe(3);

    online = true;
    const report = await engine.sync({ force: true });
    expect(report).toMatchObject({ pushed: 3, rejected: 0, offline: false });

    // Le dirigeant voit le chantier, rangé dans son entreprise, signé du poseur.
    const dirigeant = await signIn(DIRIGEANT.phone);
    const { data, error } = await dirigeant
      .from('jobsites')
      .select('id, company_id, created_by, work_types, status, clients ( full_name )')
      .eq('id', rows.jobsite.id as string)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      company_id: DEMO_COMPANY,
      created_by: POSEUR.id,
      work_types: ['combles'],
      status: 'in_progress',
      clients: { full_name: 'M. Hors-Ligne' },
    });

    // Au passage suivant, le poseur reçoit la version du serveur (entreprise, auteur…).
    await engine.sync({ force: true });
    const local = (await engine.rows('jobsites')).find((j) => j.id === rows.jobsite.id);
    expect(local).toMatchObject({ company_id: DEMO_COMPANY, created_by: POSEUR.id });
  });

  it('un refus de la RLS est mis de côté sans bloquer la file', async () => {
    const poseur = await signIn(POSEUR.phone);
    const engine = createSyncEngine({
      db: createNodeSqliteDb(),
      remote: createSupabaseRemote(poseur),
    });
    await engine.init();
    // Un poseur ne peut pas marquer un chantier « vérifié par le bureau » (section 14).
    await engine.write('jobsites', 'update', {
      id: '50000000-0000-4000-8000-000000000001',
      status: 'verified_by_office',
    });
    const report = await engine.sync({ force: true });
    expect(report.rejected).toBe(1);
    expect(await engine.status()).toMatchObject({ pending: 0, rejected: 1 });
  });
});
