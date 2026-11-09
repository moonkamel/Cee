// Visuel avant/après d'un contenu marketing (section 13), carré ou vertical. Composé à la
// première demande (floutage, mise en page, logo, ville), rangé dans le stockage privé, puis
// toujours resservi à l'identique. « ?telecharger=1 » : fichier à enregistrer.
import { isFormat, permissions, shareFileName } from '@preuvio/shared';
import { currentUser } from '@/lib/dal';
import { loadMarketingAsset } from '@/lib/marketing/queries';
import { blurRegions, composeVisual } from '@/lib/marketing/render';
import { companyColor } from '@/lib/pdf/build';
import { supabaseServer } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function GET(request: Request, ctx: RouteContext<'/marketing/[id]/[format]'>) {
  const { id, format } = await ctx.params;
  if (!isFormat(format)) return new Response('Format inconnu', { status: 404 });
  const user = await currentUser();
  if (!permissions(user.role).marketing) return new Response('Accès réservé', { status: 403 });
  const asset = await loadMarketingAsset(id);
  if (!asset) return new Response('Contenu introuvable', { status: 404 });
  const supabase = await supabaseServer();

  const download = new URL(request.url).searchParams.has('telecharger');
  const respond = (bytes: Uint8Array) =>
    new Response(bytes as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${shareFileName(asset.companies.name, format)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  const stored = async (path: string) => {
    const { data } = await supabase.storage.from('documents').download(path);
    return data ? respond(new Uint8Array(await data.arrayBuffer())) : null;
  };
  const existing = format === 'square' ? asset.square_path : asset.story_path;
  if (existing) {
    return (await stored(existing)) ?? new Response('Visuel indisponible', { status: 502 });
  }

  // Original de préférence ; s'il n'est pas lisible (HEIC…), la vignette JPEG.
  const photo = async (
    p: { original_path: string; thumbnail_path: string | null },
    regions: typeof asset.before_regions,
  ) => {
    for (const path of [p.original_path, p.thumbnail_path]) {
      if (!path) continue;
      const { data } = await supabase.storage.from('photos').download(path);
      if (!data) continue;
      try {
        return await blurRegions(new Uint8Array(await data.arrayBuffer()), regions);
      } catch {
        // format non lu par la bibliothèque d'images : essai suivant
      }
    }
    return null;
  };
  const [before, after, logo] = await Promise.all([
    photo(asset.before, asset.before_regions),
    photo(asset.after, asset.after_regions),
    asset.companies.logo_path
      ? supabase.storage
          .from('documents')
          .download(asset.companies.logo_path)
          .then(async (r) => (r.data ? new Uint8Array(await r.data.arrayBuffer()) : null))
      : Promise.resolve(null),
  ]);
  if (!before || !after) return new Response('Photo illisible', { status: 502 });
  const jpeg = new Uint8Array(
    await composeVisual(format, {
      before,
      after,
      logo,
      company: asset.companies.name,
      city: asset.city,
      color: companyColor(asset.companies.brand_color),
    }),
  );

  // Rangé une seule fois : si une autre demande l'a déjà fait, on sert celui-là.
  const path = `${asset.company_id}/marketing/${asset.id}-${format}.jpg`;
  const upload = await supabase.storage
    .from('documents')
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (upload.error)
    return (await stored(path)) ?? new Response('Visuel non enregistré', { status: 502 });
  const column = format === 'square' ? 'square_path' : 'story_path';
  await supabase
    .from('marketing_assets')
    .update({ [column]: path })
    .eq('id', asset.id)
    .is(column, null);
  return respond(jpeg);
}
