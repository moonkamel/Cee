import 'server-only';
import type { ReportKind } from '@preuvio/shared';
import type { PdfCompanyRow, PdfJobsiteRow, PdfNoteRow, PdfPhotoRow, ReportRow } from './pdf/build';
import type { PdfImage } from './pdf/ReportDocument';
import { supabaseServer } from './supabase/server';

// Rapports (section 9), lus avec la session de l'utilisateur : la RLS décide de ce qu'il voit.

export type ReportListRow = {
  id: string;
  series_id: string;
  version: number;
  kind: ReportKind;
  period: string | null;
  created_at: string;
  pdf_path: string | null;
};

const LIST_SELECT = 'id, series_id, version, kind, period, created_at, pdf_path';

export async function loadJobsiteReports(jobsiteId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('reports')
    .select(LIST_SELECT)
    .eq('jobsite_id', jobsiteId)
    .returns<ReportListRow[]>();
  return data ?? [];
}

export type LoadedReport = ReportRow & {
  company_id: string;
  jobsite_id: string;
  series_id: string;
  pdf_path: string | null;
  pdf_sha256: string | null;
  pdf_created_at: string | null;
  jobsites: PdfJobsiteRow & { id: string; companies: PdfCompanyRow & { logo_path: string | null } };
};

export async function loadReport(id: string) {
  const supabase = await supabaseServer();
  const { data: report } = await supabase
    .from('reports')
    .select(
      `id, company_id, jobsite_id, series_id, kind, version, period, content, created_at,
       pdf_path, pdf_sha256, pdf_created_at,
       jobsites ( id, reference, address, planned_start, planned_end, quote_reference,
         clients ( full_name ),
         jobsite_operations ( code, label ),
         proof_slots ( instruction, required, applicable, status, phase, position ),
         companies ( name, siret, address, brand_color, rge_qualifications, logo_path ) )`,
    )
    .eq('id', id)
    .maybeSingle<LoadedReport>();
  if (!report) return null;
  const { data: versions } = await supabase
    .from('reports')
    .select(LIST_SELECT)
    .eq('series_id', report.series_id)
    .order('version', { ascending: false })
    .returns<ReportListRow[]>();
  return { report, versions: versions ?? [] };
}

/** Photos et notes citées par une version (identifiants du contenu). */
export async function loadReportSources(photoIds: string[], noteIds: string[]) {
  const supabase = await supabaseServer();
  const [photos, notes] = await Promise.all([
    photoIds.length
      ? supabase
          .from('photos')
          .select(
            `id, device_taken_at, server_received_at, lat, lng, gps_accuracy_m, sha256, caption,
             outside_geofence, ai_result, original_path, thumbnail_path, proof_slots ( instruction, phase )`,
          )
          .in('id', photoIds)
          .is('deleted_at', null)
          .returns<(PdfPhotoRow & { original_path: string; thumbnail_path: string | null })[]>()
      : Promise.resolve({ data: [] }),
    noteIds.length
      ? supabase
          .from('voice_notes')
          .select('id, created_at, transcript, transcript_clean')
          .in('id', noteIds)
          .returns<PdfNoteRow[]>()
      : Promise.resolve({ data: [] }),
  ]);
  return { photos: photos.data ?? [], notes: notes.data ?? [] };
}

/** JPEG ou PNG reconnus à leurs premiers octets ; autre format (HEIC…) : pas d'image. */
export function imageOf(bytes: Uint8Array): PdfImage | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { data: Buffer.from(bytes), format: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { data: Buffer.from(bytes), format: 'png' };
  return null;
}

/** Fichiers du stockage privé, téléchargés avec la session (vignette de préférence). */
export async function downloadImages(
  bucket: 'photos' | 'documents',
  items: { id: string; path: string }[],
): Promise<Map<string, PdfImage>> {
  const supabase = await supabaseServer();
  const out = new Map<string, PdfImage>();
  await Promise.all(
    items.map(async ({ id, path }) => {
      const { data } = await supabase.storage.from(bucket).download(path);
      const image = data ? imageOf(new Uint8Array(await data.arrayBuffer())) : null;
      if (image) out.set(id, image);
    }),
  );
  return out;
}
