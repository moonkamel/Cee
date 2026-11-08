import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { LocalCheck } from './photo-quality';

// Traitement d'une photo juste après le déclenchement (section 6) :
// fichier rangé dans l'appli, empreinte SHA-256 de l'original, vignette de 400 px.
// L'original n'est jamais modifié : la vignette est un fichier à part.

export const THUMBNAIL_PX = 400;

export type ProcessedPhoto = {
  localUri: string;
  thumbUri: string | null;
  sha256: string;
  /** Contrôle local (S9), ou null s'il n'a pas été demandé ou n'a pas pu se faire. */
  check: LocalCheck | null;
  /** Durées en ms, pour mesurer les critères « enregistrée en moins d'une seconde » (S6)
   *  et « floue signalée en moins de 300 ms » (S9). */
  timings: { saveMs: number; hashMs: number; thumbMs: number; checkMs: number; totalMs: number };
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Empreinte SHA-256 du fichier, calculée en natif. */
export async function sha256OfFile(file: File): Promise<string> {
  return toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes()));
}

/**
 * Range le fichier pris par la caméra (`sourceUri`, temporaire) dans le dossier de l'appli,
 * puis calcule l'empreinte et la vignette en parallèle. `copy` garde la source (galerie).
 */
export async function processPhotoFile(
  sourceUri: string,
  photoId: string,
  {
    copy = false,
    size,
    check,
  }: {
    copy?: boolean;
    size?: { width: number; height: number };
    /** Contrôle de netteté et de luminosité, lancé en parallèle de l'empreinte. */
    check?: (uri: string) => Promise<LocalCheck>;
  } = {},
): Promise<ProcessedPhoto> {
  const t0 = Date.now();
  const dir = photosDirectory();
  const source = new File(sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`);
  const original = new File(dir, `${photoId}.jpg`);
  if (copy) await source.copy(original);
  else await source.move(original);
  const t1 = Date.now();

  const hash = (async () => {
    const value = await sha256OfFile(original);
    return { value, ms: Date.now() - t1 };
  })();
  const thumb = (async () => {
    try {
      const landscape = size ? size.width >= size.height : true;
      const image = await ImageManipulator.manipulate(original.uri)
        .resize(landscape ? { width: THUMBNAIL_PX } : { height: THUMBNAIL_PX })
        .renderAsync();
      const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
      const thumbFile = new File(dir, `${photoId}.thumb.jpg`);
      await new File(saved.uri).move(thumbFile);
      return { uri: thumbFile.uri, ms: Date.now() - t1 };
    } catch {
      // Sans vignette, l'écran affiche l'original : jamais de blocage.
      return { uri: null, ms: Date.now() - t1 };
    }
  })();

  const quality = (async () => {
    if (!check) return { value: null, ms: 0 };
    try {
      return { value: await check(original.uri), ms: Date.now() - t1 };
    } catch {
      // Contrôle impossible (format inattendu) : la photo est gardée telle quelle.
      return { value: null, ms: Date.now() - t1 };
    }
  })();

  const [h, th, q] = await Promise.all([hash, thumb, quality]);
  return {
    localUri: original.uri,
    thumbUri: th.uri,
    sha256: h.value,
    check: q.value,
    timings: {
      saveMs: t1 - t0,
      hashMs: h.ms,
      thumbMs: th.ms,
      checkMs: q.ms,
      totalMs: Date.now() - t0,
    },
  };
}
