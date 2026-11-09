// PV signé d'un chantier (section 12) : lien signé de 5 minutes, avec la session du bureau.
import { permissions } from '@preuvio/shared';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(_: Request, ctx: RouteContext<'/chantiers/[id]/pv'>) {
  const user = await currentUser();
  if (!permissions(user.role).decide) return new Response('Accès réservé', { status: 403 });
  const { id } = await ctx.params;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('signatures')
    .select('pdf_path')
    .eq('jobsite_id', id)
    .not('pdf_path', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.pdf_path) return new Response('PV introuvable', { status: 404 });
  const { data: link } = await supabase.storage
    .from('documents')
    .createSignedUrl(data.pdf_path, 300);
  return link?.signedUrl
    ? Response.redirect(link.signedUrl, 302)
    : new Response('PV indisponible', { status: 502 });
}
