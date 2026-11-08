import { describe, expect, it } from 'vitest';
import { classifyError } from './supabase-remote';

describe('classifyError', () => {
  it.each([
    [0, undefined],
    [401, 'PGRST301'],
    [429, undefined],
    [503, 'PGRST000'],
  ])('réessaie plus tard sur HTTP %s', (status, code) => {
    expect(classifyError({ code, message: 'x' }, status)).toMatchObject({
      ok: false,
      kind: 'retry',
    });
  });

  it.each([
    [403, '42501'],
    [400, '23514'],
    [409, '23503'],
  ])('met de côté un refus définitif (HTTP %s, %s)', (status, code) => {
    expect(classifyError({ code, message: 'refus' }, status)).toMatchObject({
      ok: false,
      kind: 'rejected',
    });
  });
});
