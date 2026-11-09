import { describe, expect, it } from 'vitest';
import { createSyncEngine } from '../sync/engine';
import { createFakeRemote } from '../sync/testing/fake-remote';
import { createNodeSqliteDb } from '../sync/testing/node-sqlite';
import { buildVoiceNoteRow, MAX_VOICE_SECONDS, VoiceNoteError } from '../voice';
import type { UploadConditions } from './photo-uploader';
import { createVoiceUploader, notesToUpload, type VoiceTransport } from './voice-uploader';

let clock = Date.parse('2026-11-09T08:00:00Z');
const now = () => clock;
const GOOD: UploadConditions = {
  online: true,
  wifi: true,
  wifiOnly: false,
  batteryLevel: 1,
  charging: false,
};

async function setup() {
  const server = createFakeRemote(now);
  const engine = createSyncEngine({ db: createNodeSqliteDb(), remote: server.remote, now });
  await engine.init();
  const phone = new Set<string>();
  const storage = new Set<string>();
  const state = { online: true };
  const transport: VoiceTransport = {
    async upload(path, uri) {
      if (!state.online) return 'retry';
      if (!phone.has(uri)) return 'rejected';
      if (storage.has(path)) return 'exists';
      storage.add(path);
      return 'ok';
    },
    async deleteLocal(uri) {
      phone.delete(uri);
    },
  };
  const uploader = createVoiceUploader({ engine, transport, now });
  return { server, engine, phone, storage, state, uploader };
}

async function record(ctx: Awaited<ReturnType<typeof setup>>, id: string) {
  const row = buildVoiceNoteRow({
    id,
    companyId: 'c1',
    jobsiteId: 'j1',
    authorId: 'u1',
    photoId: null,
    durationS: 12.34,
  });
  ctx.phone.add(`file:///voice/${id}.m4a`);
  await ctx.engine.write('voice_notes', 'insert', { ...row, _localUri: `file:///voice/${id}.m4a` });
  return row;
}

describe('fiche d’une note vocale', () => {
  it('range l’audio sous l’entreprise, borne la durée à 2 minutes', () => {
    const row = buildVoiceNoteRow({
      id: 'n',
      companyId: 'c',
      jobsiteId: 'j',
      authorId: 'u',
      photoId: 'p',
      durationS: 120.04,
    });
    expect(row).toMatchObject({
      audio_path: 'c/j/n.m4a',
      duration_s: MAX_VOICE_SECONDS,
      photo_id: 'p',
    });
    expect(() =>
      buildVoiceNoteRow({
        id: 'n',
        companyId: 'c',
        jobsiteId: 'j',
        authorId: 'u',
        photoId: null,
        durationS: 0,
      }),
    ).toThrow(VoiceNoteError);
  });
});

describe('envoi des notes vocales', () => {
  it('hors ligne : rien ne part ; au retour du réseau, fiche puis audio', async () => {
    const ctx = await setup();
    ctx.server.state.online = false;
    ctx.state.online = false;
    const row = await record(ctx, 'n1');
    await ctx.engine.sync();
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ uploaded: 0, waiting: 1 });

    ctx.server.state.online = true;
    ctx.state.online = true;
    await ctx.engine.sync({ force: true });
    expect(await ctx.uploader.run(GOOD, { force: true })).toMatchObject({
      uploaded: 1,
      waiting: 0,
    });
    expect(ctx.storage.has(String(row.audio_path))).toBe(true);
    // Le serveur apprend que l'audio est arrivé : la transcription peut commencer.
    await ctx.engine.sync({ force: true });
    expect(ctx.server.rows('voice_notes')[0]).toMatchObject({ upload_status: 'uploaded' });
    // L'audio reste sur le téléphone tant que la transcription n'est pas revenue.
    expect(ctx.phone.has('file:///voice/n1.m4a')).toBe(true);
  });

  it('libère le téléphone une fois la transcription revenue', async () => {
    const ctx = await setup();
    await record(ctx, 'n1');
    await ctx.engine.sync();
    await ctx.uploader.run(GOOD);
    await ctx.engine.sync({ force: true });
    const serverRow = ctx.server.rows('voice_notes')[0]!;
    ctx.server.serverWrite('voice_notes', {
      ...serverRow,
      status: 'done',
      transcript: 'il manque un raccord',
    });
    await ctx.engine.sync({ force: true });
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ released: 1 });
    expect(ctx.phone.has('file:///voice/n1.m4a')).toBe(false);
    expect((await ctx.engine.rows('voice_notes'))[0]!._localUri).toBeNull();
  });

  it('batterie faible ou Wi-Fi exigé : la note attend', async () => {
    const ctx = await setup();
    await record(ctx, 'n1');
    await ctx.engine.sync();
    expect(await ctx.uploader.run({ ...GOOD, batteryLevel: 0.05 })).toMatchObject({
      uploaded: 0,
      waiting: 1,
    });
    expect(await ctx.uploader.run({ ...GOOD, wifi: false, wifiOnly: true })).toMatchObject({
      uploaded: 0,
    });
  });

  it('coupure en cours d’envoi : nouvel essai après le délai', async () => {
    const ctx = await setup();
    await record(ctx, 'n1');
    await ctx.engine.sync();
    ctx.state.online = false;
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ failed: 1, waiting: 1 });
    ctx.state.online = true;
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ uploaded: 0 }); // délai pas écoulé
    clock += 6_000;
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ uploaded: 1 });
  });

  it('audio déjà présent (envoi répété) : compté comme envoyé ; l’ordre suit l’enregistrement', async () => {
    const ctx = await setup();
    const row = await record(ctx, 'n1');
    await ctx.engine.sync();
    ctx.storage.add(String(row.audio_path));
    expect(await ctx.uploader.run(GOOD)).toMatchObject({ uploaded: 1 });
    expect(
      notesToUpload([
        { id: 'b', created_at: '2', _localUri: 'x' },
        { id: 'a', created_at: '1', _localUri: 'y' },
        { id: 'c', _localUri: 'z', upload_status: 'uploaded' },
        { id: 'd', _localUri: 'w', deleted_at: '1' },
      ]).map((n) => n.id),
    ).toEqual(['a', 'b']);
  });
});
