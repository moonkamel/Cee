import { analyzePhoto, SHARPNESS_SIZE, type QualityResult } from '@preuvio/shared';
import { Images } from 'react-native-nitro-image';

// Contrôle local d'une photo (section 8) : netteté, luminosité, image vide, sur une version
// réduite à 1024 px, sans réseau. Le décodage et la réduction se font en natif.

/** Verdict enregistré avec la photo (photos.local_check). */
export type LocalCheck = QualityResult & {
  ms: number;
  /** Gardée malgré l'alerte (true), reprise (false), pas d'alerte ou pas de choix (null). */
  kept: boolean | null;
};

export async function checkPhotoQuality(uri: string): Promise<LocalCheck> {
  const t0 = Date.now();
  const image = await Images.loadFromFileAsync(uri.replace(/^file:\/\//, ''));
  const scale = Math.min(1, SHARPNESS_SIZE / Math.max(image.width, image.height));
  const small =
    scale < 1
      ? await image.resizeAsync(Math.round(image.width * scale), Math.round(image.height * scale))
      : image;
  const raw = await small.toRawPixelDataAsync();
  const format = raw.pixelFormat === 'unknown' ? 'RGBA' : raw.pixelFormat;
  const result = analyzePhoto({
    data: new Uint8Array(raw.buffer),
    width: raw.width,
    height: raw.height,
    format,
  });
  return { ...result, ms: Date.now() - t0, kept: null };
}
