// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { inviteErrorMessage } from '../invite';

vi.mock('server-only', () => ({}));
vi.mock('../../supabase/server', () => ({ supabaseServer: vi.fn() }));
const { demoImage } = await import('../demo');

describe('chantier de démonstration', () => {
  it('illustration JPEG 1 200 × 900 par preuve', async () => {
    const image = await demoImage('Unité extérieure posée', 'apres');
    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1200, 900, 'jpeg']);
  });
});

describe('invitation refusée', () => {
  const failed = (body: unknown) => ({ context: { json: async () => body } });
  it('limite de l’offre ou fin d’essai, sinon message général', async () => {
    expect(
      await inviteErrorMessage(
        failed({
          error: 'Invitation refusée',
          detail: 'Offre limitée à 2 utilisateurs : changez d’offre pour inviter',
        }),
      ),
    ).toBe('Offre limitée à 2 utilisateurs : changez d’offre pour inviter');
    expect(
      await inviteErrorMessage(
        failed({ detail: 'Essai terminé : choisissez une offre pour inviter' }),
      ),
    ).toBe('Essai terminé : choisissez une offre pour inviter');
    expect(await inviteErrorMessage(failed({ detail: 'duplicate key' }))).toContain(
      'Invitation refusée',
    );
    expect(
      await inviteErrorMessage({
        context: {
          json: async () => {
            throw new Error('x');
          },
        },
      }),
    ).toContain('Invitation refusée');
    expect(await inviteErrorMessage(null)).toContain('Invitation refusée');
  });
});
