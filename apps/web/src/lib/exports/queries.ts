import 'server-only';
import { exportChecks, type ExportCheck, requiredDocuments } from '@preuvio/shared';
import { supabaseServer } from '../supabase/server';

// Écran d'export (section 11) : chantiers exportables, vérification pour le délégataire choisi,
// historique. Lectures avec la session du bureau.

export type Delegataire = {
  id: string;
  company_id: string | null;
  name: string;
  naming_pattern: string;
  required_documents: unknown;
};

export async function loadDelegataires(): Promise<Delegataire[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('delegataires')
    .select('id, company_id, name, naming_pattern, required_documents')
    .order('name');
  return (data ?? []) as Delegataire[];
}

export type Candidate = {
  id: string;
  reference: string | null;
  address: string;
  status: string;
  client: string | null;
  checks: ExportCheck[];
};

/** Chantiers terminés ou plus loin, avec la vérification pour ce délégataire (ou par défaut). */
export async function loadCandidates(delegataire: Delegataire | null): Promise<Candidate[]> {
  const supabase = await supabaseServer();
  const [{ data: jobsites }, { data: company }] = await Promise.all([
    supabase
      .from('jobsites')
      .select(
        `id, reference, address, status, planned_start, planned_end, clients ( full_name ),
         proof_slots ( instruction, required, applicable, status ),
         jobsite_documents ( kind, document_date, deleted_at ),
         photos ( device_taken_at, deleted_at )`,
      )
      .in('status', [
        'in_progress',
        'completed_by_installer',
        'verified_by_office',
        'exported',
        'inspected',
      ])
      .order('planned_end', { ascending: false }),
    supabase.from('companies').select('rge_qualifications').maybeSingle(),
  ]);
  const required = requiredDocuments(delegataire?.required_documents);
  return (jobsites ?? []).map((j) => {
    const taken = (j.photos as { device_taken_at: string; deleted_at: string | null }[])
      .filter((p) => !p.deleted_at)
      .map((p) => p.device_taken_at.slice(0, 10))
      .sort();
    return {
      id: j.id,
      reference: j.reference,
      address: j.address,
      status: j.status,
      client: (j.clients as unknown as { full_name: string } | null)?.full_name ?? null,
      checks: exportChecks({
        slots: j.proof_slots as never,
        documents: (
          j.jobsite_documents as {
            kind: string;
            document_date: string | null;
            deleted_at: string | null;
          }[]
        ).filter((d) => !d.deleted_at),
        required,
        // Période réelle des travaux : première et dernière photo ; sinon les dates prévues.
        worksStart: taken[0] ?? j.planned_start,
        worksEnd: taken.at(-1) ?? j.planned_end,
        rge: company?.rge_qualifications,
      }),
    };
  });
}

export type ExportRow = {
  id: string;
  batch_id: string;
  status: string;
  incomplete: boolean;
  checks: ExportCheck[];
  error: string | null;
  zip_size: number | null;
  sent_to: string | null;
  sent_at: string | null;
  link_expires_at: string | null;
  created_at: string;
  jobsite_ids: string[];
  delegataires: { name: string } | null;
};

export async function loadExports(
  limit = 50,
): Promise<(ExportRow & { reference: string | null })[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('exports')
    .select(
      'id, batch_id, status, incomplete, checks, error, zip_size, sent_to, sent_at, link_expires_at, created_at, jobsite_ids, delegataires ( name )',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<ExportRow[]>();
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((r) => r.jobsite_ids))];
  const { data: refs } = ids.length
    ? await supabase.from('jobsites').select('id, reference, address').in('id', ids)
    : { data: [] };
  const byId = new Map((refs ?? []).map((r) => [r.id, r.reference ?? r.address]));
  return rows.map((r) => ({ ...r, reference: byId.get(r.jobsite_ids[0]!) ?? null }));
}

export async function loadJobsiteDocuments(jobsiteId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('jobsite_documents')
    .select('id, kind, label, file_name, file_path, document_date, created_at')
    .eq('jobsite_id', jobsiteId)
    .is('deleted_at', null)
    .order('created_at');
  return data ?? [];
}
