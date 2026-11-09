// Annotations d'une photo (section 9) : flèche, cercle, rectangle et texte, sur un calque
// séparé (photos.annotations). La photo d'origine n'est jamais modifiée. Coordonnées
// relatives (0 à 1) : le calque se superpose à toute taille d'affichage.
import { z } from 'zod';

const coord = z.number().min(0).max(1);
const point = z.object({ x: coord, y: coord });

export const annotationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('arrow'), from: point, to: point }),
  z.object({ type: z.literal('circle'), from: point, to: point }),
  z.object({ type: z.literal('rect'), from: point, to: point }),
  z.object({ type: z.literal('text'), at: point, text: z.string().min(1).max(200) }),
]);
export const annotationsSchema = z.array(annotationSchema).max(50);
export type Annotation = z.infer<typeof annotationSchema>;
export type AnnotationTool = Annotation['type'];
export type Point = z.infer<typeof point>;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Point touché (pixels) → coordonnées relatives au calque. */
export function toRelative(
  px: { x: number; y: number },
  size: { width: number; height: number },
): Point {
  return { x: clamp(px.x / size.width), y: clamp(px.y / size.height) };
}

/** Un geste trop court (simple tap) ne dessine rien, sauf pour poser un texte. */
export const MIN_SHAPE = 0.02;

export function shapeFromDrag(
  tool: Exclude<AnnotationTool, 'text'>,
  from: Point,
  to: Point,
): Annotation | null {
  if (Math.hypot(to.x - from.x, to.y - from.y) < MIN_SHAPE) return null;
  return { type: tool, from, to };
}

/** Lecture tolérante : des annotations illisibles ne bloquent jamais l'affichage de la photo. */
export function parseAnnotations(value: unknown): Annotation[] {
  const result = annotationsSchema.safeParse(value);
  return result.success ? result.data : [];
}

/** Pointe de flèche : deux segments de `size` (relatif) à ±28° de la direction. */
export function arrowHead(from: Point, to: Point, size = 0.04): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = (28 * Math.PI) / 180;
  const at = (a: number) => ({ x: to.x - size * Math.cos(a), y: to.y - size * Math.sin(a) });
  return [at(angle - spread), at(angle + spread)];
}

/** Rectangle englobant (pour le rectangle et l'ellipse du cercle), quel que soit le sens du geste. */
export function bounds(from: Point, to: Point) {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}
