// Contrôle local d'une photo (section 8) : netteté, luminosité, image vide.
// Tourne sur le téléphone, sans réseau, sur la vignette : quelques millisecondes.
// Seuils calibrés sur le jeu de test (quality.calibration.test.ts), à revoir sur de vraies
// photos de chantier pendant le test terrain.

/** Ordre des octets d'un pixel (celui que renvoie la plateforme, voir react-native-nitro-image). */
export type PixelFormat =
  'RGBA' | 'BGRA' | 'ARGB' | 'ABGR' | 'RGBX' | 'BGRX' | 'XRGB' | 'XBGR' | 'RGB' | 'BGR' | 'GRAY';

export type PixelImage = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  format: PixelFormat;
};

/** Côté le plus long pour la luminosité : les mesures ne dépendent pas de la taille d'entrée. */
export const EXPOSURE_SIZE = 256;
/**
 * Côté le plus long pour la netteté, mesurée au centre de l'image (la moitié de chaque côté).
 * Une vignette de 400 px cache un léger bougé qui rend pourtant une plaque illisible.
 */
export const SHARPNESS_SIZE = 1024;

export const QUALITY_THRESHOLDS = {
  /** Écart type de luminance sous lequel l'image est « vide » (objectif masqué, poche). */
  emptyStdDev: 8,
  /** Luminance moyenne (0-255) sous laquelle la photo est trop sombre. */
  darkMean: 40,
  /** Part des pixels très sombres (< 30) au-delà de laquelle la photo est trop sombre. */
  darkFraction: 0.8,
  /** Part des pixels brûlés (> 250) au-delà de laquelle la photo est surexposée. */
  brightFraction: 0.5,
  /** Netteté des bords (voir `sharpness`) sous laquelle la photo est floue. */
  minSharpness: 0.17,
} as const;

export type QualityIssue = 'empty' | 'dark' | 'overexposed' | 'blurry';

export type QualityMetrics = {
  mean: number;
  stdDev: number;
  darkFraction: number;
  brightFraction: number;
  sharpness: number;
};

export type QualityResult = {
  verdict: 'ok' | QualityIssue;
  metrics: QualityMetrics;
};

const CHANNELS: Record<PixelFormat, { step: number; r: number; g: number; b: number }> = {
  RGBA: { step: 4, r: 0, g: 1, b: 2 },
  RGBX: { step: 4, r: 0, g: 1, b: 2 },
  BGRA: { step: 4, r: 2, g: 1, b: 0 },
  BGRX: { step: 4, r: 2, g: 1, b: 0 },
  ARGB: { step: 4, r: 1, g: 2, b: 3 },
  XRGB: { step: 4, r: 1, g: 2, b: 3 },
  ABGR: { step: 4, r: 3, g: 2, b: 1 },
  XBGR: { step: 4, r: 3, g: 2, b: 1 },
  RGB: { step: 3, r: 0, g: 1, b: 2 },
  BGR: { step: 3, r: 2, g: 1, b: 0 },
  GRAY: { step: 1, r: 0, g: 0, b: 0 },
};

/**
 * Luminance réduite par moyenne de blocs (côté le plus long ≈ `maxSide`), éventuellement
 * limitée au rectangle central (`centerFraction` de chaque côté).
 */
export function toLuma(
  image: PixelImage,
  maxSide: number,
  centerFraction = 1,
): { luma: Float32Array; width: number; height: number } {
  const { data, width, height } = image;
  const { step, r, g, b } = CHANNELS[image.format];
  if (data.length < width * height * step) throw new Error('Données de pixels incomplètes');
  const factor = Math.max(1, Math.round(Math.max(width, height) / maxSide));
  const x0 = Math.floor((width * (1 - centerFraction)) / 2);
  const y0 = Math.floor((height * (1 - centerFraction)) / 2);
  const w = Math.floor((width * centerFraction) / factor);
  const h = Math.floor((height * centerFraction) / factor);
  const luma = new Float32Array(w * h);
  const area = factor * factor;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        let i = ((y0 + y * factor + dy) * width + x0 + x * factor) * step;
        for (let dx = 0; dx < factor; dx += 1, i += step) {
          sum += 0.299 * data[i + r]! + 0.587 * data[i + g]! + 0.114 * data[i + b]!;
        }
      }
      luma[y * w + x] = sum / area;
    }
  }
  return { luma, width: w, height: h };
}

function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0;
  // Histogramme sur 0..1024 : rapide et suffisant pour des dérivées de luminance.
  const bins = new Uint32Array(1025);
  for (const v of values) bins[Math.min(1024, Math.round(v))]! += 1;
  const target = p * values.length;
  let seen = 0;
  for (let i = 0; i < bins.length; i += 1) {
    seen += bins[i]!;
    if (seen >= target) return i;
  }
  return 1024;
}

/**
 * Netteté des bords, indépendante du contraste et de la taille : pente des bords les plus
 * raides (rapportée à l'écart entre zones claires et sombres), dans la pire direction.
 * Un bord net passe du sombre au clair en un pixel (≈ 1) ; un flou l'étale (≈ 1 / largeur).
 * La pire direction attrape le bougé, qui n'étale les bords que dans un sens.
 */
export function sharpness(luma: Float32Array, width: number, height: number): number {
  const n = Math.max(0, (width - 2) * (height - 2));
  if (n === 0) return 0;
  const range = percentile(luma, 0.99) - percentile(luma, 0.01);
  if (range < 16) return 0;
  const offsets = [1, width, width + 1, width - 1];
  let worst = Infinity;
  for (const o of offsets) {
    const diffs = new Float32Array(n);
    let k = 0;
    for (let y = 1; y < height - 1; y += 1)
      for (let x = 1; x < width - 1; x += 1, k += 1) {
        const i = y * width + x;
        diffs[k] = Math.abs(luma[i + o]! - luma[i - o]!) / 2;
      }
    worst = Math.min(worst, percentile(diffs, EDGE_PERCENTILE) / range);
  }
  return worst;
}

/** Part des pixels considérés comme « bords » : les plus raides 0,3 %. */
const EDGE_PERCENTILE = 0.997;

export function measureQuality(image: PixelImage): QualityMetrics {
  const { luma } = toLuma(image, EXPOSURE_SIZE);
  const center = toLuma(image, SHARPNESS_SIZE, 0.5);
  let sum = 0;
  let sumSq = 0;
  let dark = 0;
  let bright = 0;
  for (const v of luma) {
    sum += v;
    sumSq += v * v;
    if (v < 30) dark += 1;
    if (v > 250) bright += 1;
  }
  const n = luma.length || 1;
  const mean = sum / n;
  return {
    mean,
    stdDev: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    darkFraction: dark / n,
    brightFraction: bright / n,
    sharpness: sharpness(center.luma, center.width, center.height),
  };
}

/** Verdict : le défaut le plus grave d'abord (vide, sombre, surexposée, floue). */
export function judgeQuality(
  metrics: QualityMetrics,
  thresholds: typeof QUALITY_THRESHOLDS = QUALITY_THRESHOLDS,
): QualityResult['verdict'] {
  if (metrics.mean < thresholds.darkMean || metrics.darkFraction > thresholds.darkFraction)
    return 'dark';
  if (metrics.brightFraction > thresholds.brightFraction) return 'overexposed';
  if (metrics.stdDev < thresholds.emptyStdDev) return 'empty';
  if (metrics.sharpness < thresholds.minSharpness) return 'blurry';
  return 'ok';
}

export function analyzePhoto(image: PixelImage): QualityResult {
  const metrics = measureQuality(image);
  return { verdict: judgeQuality(metrics), metrics };
}
