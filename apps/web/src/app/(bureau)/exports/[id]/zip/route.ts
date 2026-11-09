// ZIP d'un export (section 11). POST : fabrication (un chantier par appel, pour rester dans la
// durée d'une fonction) ; GET : téléchargement par lien signé de 10 minutes.
import { permissions } from '@preuvio/shared';
import { currentUser } from '@/lib/dal';
import { buildExport } from '@/lib/exports/build';
import { supabaseServer } from '@/lib/supabase/server';

export const maxDuration = 300;

async function allowed() {
  const user = await currentUser();
  return permissions(user.role).export;
}

export async function POST(_: Request, ctx: RouteContext<'/exports/[id]/zip'>) {
  if (!(await allowed()))
    return Response.json({ ok: false, error: 'Accès réservé' }, { status: 403 });
  const { id } = await ctx.params;
  const result = await buildExport(id);
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(_: Request, ctx: RouteContext<'/exports/[id]/zip'>) {
  if (!(await allowed())) return new Response('Accès réservé', { status: 403 });
  const { id } = await ctx.params;
  const supabase = await supabaseServer();
  const { data: exp } = await supabase
    .from('exports')
    .select('zip_path, jobsite_ids')
    .eq('id', id)
    .maybeSingle();
  if (!exp?.zip_path) return new Response('Export pas encore prêt', { status: 404 });
  const { data: jobsite } = await supabase
    .from('jobsites')
    .select('reference')
    .eq('id', exp.jobsite_ids[0])
    .maybeSingle();
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(exp.zip_path, 600, { download: `${jobsite?.reference ?? 'dossier'}.zip` });
  if (!data?.signedUrl) return new Response('Lien indisponible', { status: 502 });
  return Response.redirect(data.signedUrl, 302);
}
