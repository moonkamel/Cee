// Liste de tous les chantiers de l'entreprise en CSV (export complet, section 15).
import { jobsitesCsv, permissions } from '@preuvio/shared';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) return new Response('Accès réservé', { status: 403 });
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('jobsites')
    .select(
      `reference, address, status, planned_start, planned_end, quote_reference, created_at,
       clients ( full_name, phone, email ), jobsite_operations ( code ), photos!photos_jobsite_id_company_id_fkey ( id )`,
    )
    .eq('is_demo', false)
    .order('created_at');
  return new Response(jobsitesCsv((data ?? []) as never), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="chantiers.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
