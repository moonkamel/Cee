import { describe, expect, it } from 'vitest';
import { arrowHead, bounds, parseAnnotations, shapeFromDrag, toRelative } from './annotations';

describe('annotations sur calque séparé', () => {
  it('coordonnées relatives, bornées au calque', () => {
    expect(toRelative({ x: 50, y: 150 }, { width: 200, height: 100 })).toEqual({ x: 0.25, y: 1 });
    expect(toRelative({ x: -5, y: 10 }, { width: 200, height: 100 })).toEqual({ x: 0, y: 0.1 });
  });

  it('un simple tap ne dessine pas de forme', () => {
    expect(shapeFromDrag('arrow', { x: 0.5, y: 0.5 }, { x: 0.505, y: 0.5 })).toBeNull();
    expect(shapeFromDrag('rect', { x: 0.1, y: 0.1 }, { x: 0.4, y: 0.3 })).toEqual({
      type: 'rect',
      from: { x: 0.1, y: 0.1 },
      to: { x: 0.4, y: 0.3 },
    });
  });

  it('rectangle englobant quel que soit le sens du geste', () => {
    const b = bounds({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 });
    expect(b.x).toBeCloseTo(0.2);
    expect(b.y).toBeCloseTo(0.3);
    expect(b.width).toBeCloseTo(0.4);
    expect(b.height).toBeCloseTo(0.5);
  });

  it('pointe de flèche symétrique, du côté de la cible', () => {
    const [a, b] = arrowHead({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 0.1);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.x).toBeLessThan(1);
    expect(a.y + b.y).toBeCloseTo(1);
  });

  it('lecture tolérante des annotations enregistrées', () => {
    const ok = [{ type: 'text', at: { x: 0.2, y: 0.2 }, text: 'Fuite ici' }];
    expect(parseAnnotations(ok)).toEqual(ok);
    expect(parseAnnotations([{ type: 'star' }])).toEqual([]);
    expect(parseAnnotations(null)).toEqual([]);
    expect(parseAnnotations([{ type: 'rect', from: { x: 2, y: 0 }, to: { x: 0, y: 0 } }])).toEqual(
      [],
    );
  });
});
