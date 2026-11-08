import { describe, expect, it } from 'vitest';
import { colors, palette } from './colors';

describe('jetons de couleur', () => {
  it('définit chaque jeton en mode clair et sombre, au format hexadécimal', () => {
    for (const value of Object.values(colors)) {
      expect(value.light).toMatch(/^#[0-9A-F]{6}$/);
      expect(value.dark).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('résout la palette selon le mode', () => {
    expect(palette('light').action).toBe('#EA580C');
    expect(palette('dark').bg).toBe('#0B1220');
  });
});
