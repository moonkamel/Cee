import { describe, expect, it } from 'vitest';
import { COLOR_SCHEMES, colors, palette } from './colors';
import { CONTRAST, contrastRatio } from './contrast';
import { sizes } from './layout';
import { MIN_FONT_SIZE, typography } from './typography';

describe('jetons de couleur', () => {
  it('définit chaque jeton dans les trois modes, au format hexadécimal', () => {
    for (const value of Object.values(colors)) {
      for (const scheme of COLOR_SCHEMES) expect(value[scheme]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('résout la palette selon le mode', () => {
    expect(palette('light').action).toBe('#9A3412');
    expect(palette('contrast').bg).toBe('#000000');
  });
});

describe.each(COLOR_SCHEMES)('contrastes WCAG en mode %s', (scheme) => {
  const p = palette(scheme);

  it('le texte des actions principales atteint 7:1', () => {
    expect(contrastRatio(p['on-action'], p.action)).toBeGreaterThanOrEqual(CONTRAST.action);
  });

  it('le texte principal atteint 7:1 sur le fond et les cartes', () => {
    for (const background of [p.bg, p.surface]) {
      expect(contrastRatio(p.text, background)).toBeGreaterThanOrEqual(CONTRAST.action);
    }
  });

  it('les couleurs de texte et de statut atteignent au moins AA (4,5:1)', () => {
    const min = scheme === 'contrast' ? CONTRAST.action : CONTRAST.text;
    for (const token of ['text-muted', 'brand', 'ok', 'warn', 'ko'] as const) {
      for (const background of [p.bg, p.surface]) {
        expect(
          contrastRatio(p[token], background),
          `${token} sur ${background}`,
        ).toBeGreaterThanOrEqual(min);
      }
    }
  });
});

describe('contrastRatio', () => {
  it('donne 21:1 entre noir et blanc, et 1:1 pour une même couleur', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#EA580C', '#EA580C')).toBe(1);
  });

  it('refuse une couleur invalide', () => {
    expect(() => contrastRatio('rouge', '#FFFFFF')).toThrow();
  });
});

describe('tailles', () => {
  it("n'a aucun texte sous 16", () => {
    for (const v of Object.values(typography))
      expect(v.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });

  it('respecte les cibles tactiles de la section 3', () => {
    expect(sizes.touchMin).toBeGreaterThanOrEqual(56);
    expect(sizes.bigButton).toBe(64);
    expect(sizes.shutter).toBe(88);
  });
});
