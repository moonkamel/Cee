import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Traitement d'une photo juste après le déclenchement (section 6) :
// fichier rangé dans l'appli, empreinte SHA-256 de l'original, vignette de 400 px.
// L'original n'est jamais modifié : la vignette est un fichier à part.

export const THUMBNAIL_PX = 400;

export type ProcessedPhoto = {
  localUri: string;
  thumbUri: string | null;
  sha256: string;
  /** Durées en ms, pour mesurer le critère « photo enregistrée en moins d'une seconde ». */
  timings: { saveMs: number; hashMs: number; thumbMs: number; totalMs: number };
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
  { copy = false, size }: { copy?: boolean; size?: { width: number; height: number } } = {},
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

  const [h, th] = await Promise.all([hash, thumb]);
  return {
    localUri: original.uri,
    thumbUri: th.uri,
    sha256: h.value,
    timings: { saveMs: t1 - t0, hashMs: h.ms, thumbMs: th.ms, totalMs: Date.now() - t0 },
  };
}
