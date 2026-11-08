// Jeu de test généré pour calibrer le contrôle local (S9) : scènes de chantier simplifiées
// (façade peu texturée, plaque à petits caractères, carter à grille, chantier encombré),
// puis leurs défauts (flou, bougé, sombre, surexposé, vide). Déterministe (graine fixe).
// À compléter par de vraies photos : voir fixtures/photo-quality/README.md.
import type { PixelImage } from '../analyze';

export const W = 1024;
export const H = 768;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type Gray = Float32Array;

function rect(img: Gray, x: number, y: number, w: number, h: number, v: number) {
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j += 1)
    for (let i = Math.max(0, x); i < Math.min(W, x + w); i += 1) img[j * W + i] = v;
}

function scene(kind: SceneKind, seed: number): Gray {
  const r = rng(seed);
  const img = new Float32Array(W * H);
  const base = 90 + r() * 80;
  img.fill(base);
  // Léger dégradé d'éclairage.
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) img[j * W + i]! += (i / W) * 25;

  if (kind === 'facade') {
    // Mur presque uni, quelques fenêtres et un numéro : peu de bords, le cas difficile.
    for (let k = 0; k < 4; k += 1)
      rect(img, 80 + k * 230, 200 + (k % 2) * 60, 140, 200, 40 + r() * 30);
    rect(img, 470, 90, 70, 50, 30);
  } else if (kind === 'plaque') {
    // Plaque claire couverte de petits caractères.
    rect(img, 150, 120, 724, 528, 215);
    for (let line = 0; line < 14; line += 1)
      for (let c = 0; c < 40; c += 1)
        if (r() > 0.25) rect(img, 180 + c * 16, 150 + line * 34, 2 + Math.floor(r() * 9), 18, 40);
  } else if (kind === 'grille') {
    // Carter d'unité extérieure : fines lames horizontales, ventilateur sombre.
    rect(img, 100, 80, 824, 608, 200);
    for (let j = 120; j < 650; j += 9) rect(img, 140, j, 744, 3, 120);
    rect(img, 380, 230, 260, 260, 60);
  } else {
    // Chantier encombré : outils, tuyaux, cartons.
    for (let k = 0; k < 60; k += 1)
      rect(
        img,
        Math.floor(r() * W),
        Math.floor(r() * H),
        10 + Math.floor(r() * 160),
        4 + Math.floor(r() * 90),
        r() * 255,
      );
  }
  return img;
}

export const SCENES = ['facade', 'plaque', 'grille', 'chantier'] as const;
export type SceneKind = (typeof SCENES)[number];

function gaussianBlur(src: Gray, sigma: number): Gray {
  const radius = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
  );
  const total = kernel.reduce((a, b) => a + b, 0);
  const k = kernel.map((v) => v / total);
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j += 1)
    for (let i = 0; i < W; i += 1) {
      let s = 0;
      for (let d = -radius; d <= radius; d += 1)
        s += src[j * W + Math.min(W - 1, Math.max(0, i + d))]! * k[d + radius]!;
      tmp[j * W + i] = s;
    }
  for (let j = 0; j < H; j += 1)
    for (let i = 0; i < W; i += 1) {
      let s = 0;
      for (let d = -radius; d <= radius; d += 1)
        s += tmp[Math.min(H - 1, Math.max(0, j + d)) * W + i]! * k[d + radius]!;
      out[j * W + i] = s;
    }
  return out;
}

function motionBlur(src: Gray, length: number): Gray {
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j += 1)
    for (let i = 0; i < W; i += 1) {
      let s = 0;
      for (let d = 0; d < length; d += 1) s += src[j * W + Math.min(W - 1, i + d)]!;
      out[j * W + i] = s / length;
    }
  return out;
}

const map = (src: Gray, f: (v: number) => number) => src.map(f);

export type Expected = 'ok' | 'blurry' | 'dark' | 'overexposed' | 'empty';

export const VARIANTS: { name: string; expected: Expected; apply: (g: Gray) => Gray }[] = [
  { name: 'nette', expected: 'ok', apply: (g) => g },
  // Optique un peu douce : acceptable, ne doit pas déranger le poseur.
  { name: 'douce', expected: 'ok', apply: (g) => gaussianBlur(g, 0.7) },
  { name: 'floue', expected: 'blurry', apply: (g) => gaussianBlur(g, 2.5) },
  { name: 'tres-floue', expected: 'blurry', apply: (g) => gaussianBlur(g, 5) },
  { name: 'bouge', expected: 'blurry', apply: (g) => motionBlur(g, 12) },
  { name: 'sombre', expected: 'dark', apply: (g) => map(g, (v) => v * 0.15) },
  { name: 'surexposee', expected: 'overexposed', apply: (g) => map(g, (v) => v * 3 + 60) },
  { name: 'vide', expected: 'empty', apply: (g) => map(g, () => 128) },
  { name: 'cache', expected: 'dark', apply: (g) => map(g, () => 6) },
  // Pénombre lisible (cave, combles avec lampe) : sombre mais exploitable.
  { name: 'penombre', expected: 'ok', apply: (g) => map(g, (v) => v * 0.6) },
];

/** Image RGB de test, avec bruit de capteur ; seuls les défauts voulus la distinguent. */
export function testImage(kind: SceneKind, seed: number, variant: (typeof VARIANTS)[number]) {
  const r = rng(seed * 7919 + 17);
  const gray = variant.apply(scene(kind, seed));
  const data = new Uint8Array(W * H * 3);
  for (let p = 0; p < W * H; p += 1) {
    const v = Math.max(0, Math.min(255, gray[p]! + (r() - 0.5) * 6));
    data[p * 3] = v;
    data[p * 3 + 1] = v;
    data[p * 3 + 2] = v;
  }
  return { data, width: W, height: H, format: 'RGB' } satisfies PixelImage;
}
