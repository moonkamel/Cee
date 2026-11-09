/// <reference types="node" />
// Critère de fin de S8 : un chantier PAC air/eau se documente de bout en bout, jusqu'à
// l'écran récapitulatif, avec le vrai moteur de synchronisation (SQLite) et le vrai modèle.
import { checklistSummary, createSyncEngine, parseTemplate } from '@preuvio/shared';
import { globalTemplates } from '@preuvio/templates';
import { createFakeRemote } from '../../../../../packages/shared/src/sync/testing/fake-remote';
import { createNodeSqliteDb } from '../../../../../packages/shared/src/sync/testing/node-sqlite';
import { createLocalSource } from '../local-source';

jest.mock('@/lib/position', () => ({ localToday: () => '2026-11-09' }));

const PAC = globalTemplates.find((t) => (t as { code: string }).code === 'PAC_AIR_EAU')!;

async function setup() {
  let clock = Date.parse('2026-11-09T08:00:00Z');
  const now = () => (clock += 1000);
  const server = createFakeRemote(now);
  server.serverWrite('profiles', { id: 'u1', company_id: 'c1', role: 'installer' });
  server.serverWrite('checklist_templates', {
    id: 't-pac',
    company_id: null,
    code: 'PAC_AIR_EAU',
    version: parseTemplate(PAC).version,
    published: true,
    content: PAC,
  });
  const engine = createSyncEngine({ db: createNodeSqliteDb(), remote: server.remote, now });
  await engine.init();
  await engine.sync({ force: true });
  let n = 0;
  const source = createLocalSource({
    engine,
    currentUserId: () => 'u1',
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  });
  return { server, engine, source };
}

const photo = (jobsiteId: string, slotId: string, i: number) => ({
  id: `photo-${i}`,
  jobsiteId,
  proofSlotId: slotId,
  takenAt: `2026-11-09T09:${String(i).padStart(2, '0')}:00.000Z`,
  position: null,
  headingDeg: null,
  sha256: String(i).padStart(64, 'a'),
  source: 'camera' as const,
  width: 4000,
  height: 3000,
  localUri: `file:///p${i}.jpg`,
  thumbUri: null,
});

describe('chantier PAC air/eau de bout en bout', () => {
  it('questions, photos, dispense, récapitulatif, fin de chantier, serveur à jour', async () => {
    const { server, engine, source } = await setup();

    // 1. Création rapide hors ligne possible : la checklist vient du modèle synchronisé.
    const jobsiteId = await source.createJobsite({
      address: {
        label: '8 allée des Tilleuls 69500 Bron',
        banId: null,
        lat: 45.7,
        lng: 4.9,
        pending: false,
      },
      workTypes: ['pac_air_eau'],
      client: null,
    });
    const [operation] = await source.listOperations(jobsiteId);
    expect(operation).toMatchObject({ label: 'Pompe à chaleur air/eau', draft: true });
    expect(operation!.questions.map((q) => [q.key, q.value])).toEqual([
      ['old_boiler_removed', null],
      ['indoor_units', 1],
    ]);
    // Sans réponse, rien n'est masqué : 10 obligatoires + 1 facultative.
    expect(await source.listSlots(jobsiteId)).toHaveLength(11);

    // 2. Questions rapides : pas de chaudière déposée, deux unités intérieures.
    await source.answerQuestion(operation!.id, 'old_boiler_removed', false);
    await source.answerQuestion(operation!.id, 'indoor_units', 2);
    let slots = await source.listSlots(jobsiteId);
    expect(slots.map((s) => s.instruction)).toEqual(
      expect.arrayContaining(['Unité intérieure posée (1)', 'Unité intérieure posée (2)']),
    );
    expect(slots.some((s) => s.instruction.startsWith('Ancienne chaudière'))).toBe(false);
    let summary = checklistSummary(slots);
    expect(summary).toMatchObject({ total: 9, done: 0, complete: false });

    // 3. Photos de chaque preuve obligatoire, sauf une rendue « Impossible ».
    const required = slots.filter((s) => s.required);
    const [unreachable, ...toShoot] = required;
    let i = 0;
    for (const s of toShoot) await source.recordPhoto(photo(jobsiteId, s.id, ++i));
    await source.waiveSlot(unreachable!.id, 'inaccessible');

    // 4. Écran récapitulatif : 9 preuves sur 9, une dispense à valider par le bureau.
    slots = await source.listSlots(jobsiteId);
    summary = checklistSummary(slots);
    expect(summary).toMatchObject({ total: 9, done: 9, complete: true });
    expect(summary.waiversPending.map((s) => s.id)).toEqual([unreachable!.id]);
    expect(summary.optionalMissing).toHaveLength(1);

    // 5. Terminer : tout part au serveur, preuves écartées comprises (masquées, pas supprimées).
    await source.finishJobsite(jobsiteId);
    // Un passage peut déjà être en cours (envoi lancé par l'écran) : le suivant prend le reste.
    await engine.sync({ force: true });
    const report = await engine.sync({ force: true });
    expect(report).toMatchObject({ rejected: 0, offline: false });
    expect(server.rows('jobsites')[0]).toMatchObject({ status: 'completed_by_installer' });
    expect(server.rows('jobsite_operations')[0]).toMatchObject({
      template_version: '1.0.0',
      answers: { old_boiler_removed: false, indoor_units: 2 },
    });
    const serverSlots = server.rows('proof_slots');
    expect(
      serverSlots
        .filter((s) => s.applicable === false)
        .map((s) => s.item_key)
        .sort(),
    ).toEqual(['boiler_spot', 'old_boiler', 'old_boiler_plate']);
    expect(serverSlots.find((s) => s.id === unreachable!.id)).toMatchObject({
      status: 'waived',
      waiver_reason: 'inaccessible',
    });
    expect(server.rows('photos')).toHaveLength(toShoot.length);
    // Le chantier terminé quitte la liste du jour.
    expect((await source.listJobsites()).data).toEqual([]);
  });

  it('une preuve à deux vues reste « manquante » jusqu’à la seconde photo', async () => {
    const { engine, source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['pac_air_eau'],
      client: null,
    });
    const slot = (await source.listSlots(jobsiteId))[0]!;
    await engine.write('proof_slots', 'update', { id: slot.id, min_photos: 2 });
    await source.recordPhoto(photo(jobsiteId, slot.id, 1));
    expect((await source.listSlots(jobsiteId))[0]!.status).toBe('missing');
    await source.recordPhoto(photo(jobsiteId, slot.id, 2));
    expect((await source.listSlots(jobsiteId))[0]!.status).toBe('captured');
  });

  it('sans modèle pour ce type de travaux, pas de checklist (photos libres)', async () => {
    const { source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['vmc'],
      client: null,
    });
    expect(await source.listOperations(jobsiteId)).toEqual([]);
    expect(await source.listSlots(jobsiteId)).toEqual([]);
  });
});

describe('contrôle local : Reprendre ou Garder (S9)', () => {
  const blurry = {
    verdict: 'blurry' as const,
    metrics: { mean: 120, stdDev: 30, darkFraction: 0, brightFraction: 0, sharpness: 0.05 },
    ms: 80,
    kept: null,
  };

  it('« Reprendre » retire la photo logiquement et la preuve redevient à prendre', async () => {
    const { server, engine, source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['pac_air_eau'],
      client: null,
    });
    const slot = (await source.listSlots(jobsiteId))[0]!;
    await source.recordPhoto({ ...photo(jobsiteId, slot.id, 1), localCheck: blurry });
    expect((await source.listSlots(jobsiteId))[0]!.status).toBe('captured');

    await source.resolvePhotoCheck('photo-1', false);
    expect((await source.listSlots(jobsiteId))[0]!.status).toBe('missing');
    expect(await source.listPhotos(jobsiteId)).toEqual([]);

    await engine.sync({ force: true });
    await engine.sync({ force: true });
    // Sur le serveur, la photo existe toujours, retirée et marquée « reprise ».
    expect(server.rows('photos')[0]).toMatchObject({
      id: 'photo-1',
      local_check: { verdict: 'blurry', kept: false },
      deleted_at: expect.any(String),
    });
  });

  it('« Garder » : la photo compte, le choix est noté pour le bureau', async () => {
    const { engine, source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['pac_air_eau'],
      client: null,
    });
    const slot = (await source.listSlots(jobsiteId))[0]!;
    await source.recordPhoto({ ...photo(jobsiteId, slot.id, 1), localCheck: blurry });
    await source.resolvePhotoCheck('photo-1', true);
    expect((await source.listSlots(jobsiteId))[0]!.status).toBe('captured');
    const row = (await engine.rows('photos'))[0]!;
    expect(row).toMatchObject({ local_check: { verdict: 'blurry', kept: true } });
    expect(row.deleted_at).toBeUndefined();
  });
});

describe('pré-contrôle IA : verdict reçu du serveur (S10)', () => {
  it('message orange sur la preuve, puis « Garder quand même » part au serveur', async () => {
    const { server, engine, source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['pac_air_eau'],
      client: null,
    });
    const slot = (await source.listSlots(jobsiteId))[0]!;
    await source.recordPhoto(photo(jobsiteId, slot.id, 1));
    await engine.sync({ force: true });
    await engine.sync({ force: true });

    // Le serveur analyse la photo et passe la preuve en orange.
    const serverPhoto = server.rows('photos')[0]!;
    server.serverWrite('photos', {
      ...serverPhoto,
      ai_status: 'done',
      ai_result: { decision: { kind: 'retake', message: 'Photo floue, reprenez' } },
    });
    const serverSlot = server.rows('proof_slots').find((s) => s.id === slot.id)!;
    server.serverWrite('proof_slots', { ...serverSlot, status: 'to_retake' });
    await engine.sync({ force: true });

    expect((await source.listSlots(jobsiteId))[0]).toMatchObject({
      status: 'to_retake',
      aiMessage: 'Photo floue, reprenez',
      aiKept: false,
    });
    await source.keepDespiteAi(slot.id);
    expect((await source.listSlots(jobsiteId))[0]).toMatchObject({ aiKept: true });
    await engine.sync({ force: true });
    await engine.sync({ force: true });
    expect(server.rows('photos')[0]!.ai_kept_at).toEqual(expect.any(String));
  });
});

describe('notes vocales et annotations, avec le vrai moteur (S11)', () => {
  it('critère S11 : dictée hors ligne, envoyée à la synchronisation, transcription affichée', async () => {
    const { server, engine, source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['vmc'],
      client: null,
    });
    await engine.sync({ force: true });
    await engine.sync({ force: true });

    server.state.online = false;
    await source.recordVoiceNote({
      id: 'n1',
      jobsiteId,
      photoId: null,
      localUri: 'file:///voice/n1.m4a',
      durationS: 9,
    });
    let [note] = await source.listVoiceNotes(jobsiteId);
    expect(note).toMatchObject({ id: 'n1', status: 'pending', text: null, durationS: 9 });

    // Retour du réseau : la fiche part, le serveur transcrit (Voxtral puis Claude).
    server.state.online = true;
    await engine.sync({ force: true });
    await engine.sync({ force: true });
    const serverNote = server.rows('voice_notes').find((n) => n.id === 'n1')!;
    expect(serverNote).toMatchObject({ audio_path: `c1/${jobsiteId}/n1.m4a`, duration_s: 9 });
    server.serverWrite('voice_notes', {
      ...serverNote,
      status: 'done',
      transcript: 'il manque un raccord',
      transcript_clean: 'Il manque un raccord.',
    });
    server.serverWrite('note_items', {
      id: 'i1',
      jobsite_id: jobsiteId,
      voice_note_id: 'n1',
      kind: 'problem',
      summary: 'Raccord manquant',
      quantity: null,
      unit: null,
    });
    await engine.sync({ force: true });

    [note] = await source.listVoiceNotes(jobsiteId);
    expect(note).toMatchObject({
      status: 'done',
      text: 'Il manque un raccord.',
      items: [{ kind: 'problem', summary: 'Raccord manquant' }],
    });
  });

  it('annotations : calque enregistré sur la photo, l’original intact', async () => {
    const { server, engine, source } = await setup();
    const jobsiteId = await source.createJobsite({
      address: { label: 'Bron', banId: null, lat: null, lng: null, pending: false },
      workTypes: ['pac_air_eau'],
      client: null,
    });
    const slot = (await source.listSlots(jobsiteId))[0]!;
    await source.recordPhoto(photo(jobsiteId, slot.id, 1));
    const arrow = { type: 'arrow' as const, from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.4 } };
    await source.saveAnnotations('photo-1', [arrow]);
    expect(await source.getPhoto('photo-1')).toMatchObject({
      annotations: [arrow],
      uri: 'file:///p1.jpg',
    });
    await engine.sync({ force: true });
    await engine.sync({ force: true });
    expect(server.rows('photos')[0]).toMatchObject({
      annotations: [arrow],
      sha256: '1'.padStart(64, 'a'),
    });
    await expect(
      source.saveAnnotations('photo-1', [
        { type: 'rect', from: { x: 2, y: 0 }, to: { x: 0, y: 0 } },
      ] as never),
    ).rejects.toThrow();
    expect(await source.getPhoto('inconnue')).toBeNull();
  });
});
