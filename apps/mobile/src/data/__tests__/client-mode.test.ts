/// <reference types="node" />
// Mode client (section 12, S16) : le lien vient du serveur, après une synchronisation, et
// l'absence de réseau ne bloque rien.
import { createSyncEngine } from '@preuvio/shared';
import { createFakeRemote } from '../../../../../packages/shared/src/sync/testing/fake-remote';
import { createNodeSqliteDb } from '../../../../../packages/shared/src/sync/testing/node-sqlite';
import { createLocalSource } from '../local-source';

async function engine() {
  const server = createFakeRemote(() => Date.now());
  server.serverWrite('profiles', { id: 'u1', company_id: 'c1', role: 'installer' });
  const e = createSyncEngine({ db: createNodeSqliteDb(), remote: server.remote });
  await e.init();
  return e;
}

describe('mode client', () => {
  it('demande au serveur un lien pour ce chantier', async () => {
    const asked: string[] = [];
    const source = createLocalSource({
      engine: await engine(),
      currentUserId: () => 'u1',
      newId: () => 'x',
      clientLinks: async (id) => {
        asked.push(id);
        return `https://preuvio-web.vercel.app/c/jeton-${id}`;
      },
    });
    expect(await source.clientModeUrl('j1')).toBe('https://preuvio-web.vercel.app/c/jeton-j1');
    expect(asked).toEqual(['j1']);
  });

  it('hors ligne ou refus : pas de lien, pas d’erreur', async () => {
    const offline = createLocalSource({
      engine: await engine(),
      currentUserId: () => 'u1',
      newId: () => 'x',
      clientLinks: async () => {
        throw new Error('réseau');
      },
    });
    expect(await offline.clientModeUrl('j1')).toBeNull();
    const none = createLocalSource({
      engine: await engine(),
      currentUserId: () => 'u1',
      newId: () => 'x',
    });
    expect(await none.clientModeUrl('j1')).toBeNull();
  });
});
