// Copie floutée d'une photo pour la page client (section 16) : visages et plaques
// d'immatriculation repérés par le pré-contrôle IA. Le jeton du lien fait foi ; l'original
// n'est jamais modifié. « ?original=1 » : grande taille.
import { safeRegions } from '@preuvio/shared';
import { portalCall, type PortalView } from '@/lib/client-portal';
import { blurRegions } from '@/lib/marketing/render';

export async function GET(request: Request, ctx: RouteContext<'/c/[token]/photo/[id]'>) {
  const { token, id } = await ctx.params;
  const res = await portalCall<PortalView>({ action: 'view', token });
  if (!res.ok) return new Response('Lien invalide ou expiré', { status: 404 });
  const photo = res.data.photos.find((p) => p.id === id);
  if (!photo) return new Response('Photo introuvable', { status: 404 });
  const full = new URL(request.url).searchParams.has('original');
  const path = full ? photo.original_path : (photo.thumbnail_path ?? photo.original_path);
  const signed = res.data.urls[path];
  if (!signed) return new Response('Photo indisponible', { status: 502 });
  const regions = safeRegions(photo.privacy ?? []);
  if (regions.length === 0) return Response.redirect(signed, 302);
  const file = await fetch(signed);
  if (!file.ok) return new Response('Photo indisponible', { status: 502 });
  const blurred = await blurRegions(new Uint8Array(await file.arrayBuffer()), regions);
  return new Response(new Uint8Array(await sharpJpeg(blurred)) as BodyInit, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' },
  });
}

async function sharpJpeg(image: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(image).jpeg({ quality: 85 }).toBuffer();
}
