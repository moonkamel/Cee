import { describe, expect, it } from 'vitest';
import type { InspectionResult } from '../statuses';
import { batchRate, batchStatus } from './batch';

describe('lots CEE et seuil', () => {
  it('taux observé = non satisfaisants ÷ contrôles réalisés', () => {
    expect(batchRate(['satisfactory', 'unsatisfactory', 'unverifiable', 'satisfactory'])).toEqual({
      rate: 0.25,
      done: 4,
      failed: 1,
    });
    expect(batchRate([])).toEqual({ rate: 0, done: 0, failed: 0 });
  });

  it('proche du seuil à moins de 2 points, projection des échecs restants', () => {
    const ten = (failed: number): InspectionResult[] =>
      Array.from({ length: 10 }, (_, i) => (i < failed ? 'unsatisfactory' : 'satisfactory'));
    expect(batchStatus(ten(1), 0.14)).toMatchObject({
      rate: 0.1,
      near: false,
      over: false,
      failuresBeforeOver: 1,
    });
    expect(batchStatus(ten(1), 0.12)).toMatchObject({ near: true, over: false });
    expect(batchStatus(ten(2), 0.14)).toMatchObject({
      near: true,
      over: true,
      failuresBeforeOver: 0,
    });
    expect(batchStatus([], 0.14)).toMatchObject({
      near: false,
      over: false,
      failuresBeforeOver: null,
    });
  });
});
