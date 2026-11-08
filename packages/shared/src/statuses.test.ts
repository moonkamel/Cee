import { describe, expect, it } from 'vitest';
import { JOBSITE_STATUSES, PROOF_SLOT_STATUSES, ROLES } from './statuses';

describe('statuts', () => {
  it('suit le cycle de vie du chantier de la section 5', () => {
    expect(JOBSITE_STATUSES[0]).toBe('planned');
    expect(JOBSITE_STATUSES.at(-1)).toBe('inspected');
  });

  it('ne contient aucun doublon', () => {
    for (const list of [JOBSITE_STATUSES, PROOF_SLOT_STATUSES, ROLES]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
