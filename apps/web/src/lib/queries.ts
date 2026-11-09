import 'server-only';
import { localToday } from './today';
import type { BatchRow, JobsiteRow, NoteItemRow } from './dashboard';
import { supabaseServer } from './supabase/server';

// Lectures du tableau de bord, avec la session de l'utilisateur : la RLS décide de ce qu'il voit
// (le chef d'équipe, son équipe ; le bureau, l'admin et le dirigeant, tout).

export const JOBSITE_SELECT = `id, address, reference, status, planned_start, planned_end, lat, lng, updated_at,
  clients ( full_name ),
  jobsite_assignees ( profile_id, profiles ( full_name ) ),
  proof_slots ( id, instruction, status, required, applicable, waiver_reason, waiver_validated_at, updated_at,
    photos ( id, original_path, device_taken_at, author_id, ai_result, ai_kept_at, deleted_at ) )`;

export async function loadDashboard() {
  const supabase = await supabaseServer();
  const today = localToday();
  const [jobsites, notes, batches, threshold] = await Promise.all([
    supabase
      .from('jobsites')
      .select(JOBSITE_SELECT)
      .in('status', ['planned', 'in_progress', 'completed_by_installer'])
      .returns<JobsiteRow[]>(),
    supabase
      .from('note_items')
      .select('id, jobsite_id, kind, summary, quantity, unit, created_at')
      .eq('status', 'open')
      .returns<NoteItemRow[]>(),
    supabase
      .from('cee_batches')
      .select('id, operation_code, inspections ( result )')
      .eq('status', 'open')
      .returns<BatchRow[]>(),
    supabase
      .from('cee_thresholds')
      .select('max_nonconformity_rate')
      .eq('year', Number(today.slice(0, 4)))
      .maybeSingle(),
  ]);
  return {
    today,
    jobsites: jobsites.data ?? [],
    notes: notes.data ?? [],
    batches: batches.data ?? [],
    threshold: Number(threshold.data?.max_nonconformity_rate ?? 0.14),
  };
}

export async function loadJobsite(id: string) {
  const supabase = await supabaseServer();
  const [jobsite, notes, items] = await Promise.all([
    supabase.from('jobsites').select(JOBSITE_SELECT).eq('id', id).maybeSingle<JobsiteRow>(),
    supabase
      .from('voice_notes')
      .select('id, status, transcript, transcript_clean, duration_s, created_at, photo_id')
      .eq('jobsite_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('note_items')
      .select('id, voice_note_id, kind, summary, quantity, unit, status')
      .eq('jobsite_id', id),
  ]);
  return { jobsite: jobsite.data, notes: notes.data ?? [], items: items.data ?? [] };
}

/** Liens signés de 5 minutes vers les photos (stockage privé, section 16). */
export async function signedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const supabase = await supabaseServer();
  const { data } = await supabase.storage.from('photos').createSignedUrls(paths, 300);
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

export async function loadSlot(id: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('proof_slots')
    .select(
      `id, instruction, status, jobsite_id, jobsites ( address, jobsite_assignees ( profile_id, profiles ( full_name ) ) ),
       photos ( id, original_path, device_taken_at, author_id, ai_result, ai_kept_at, deleted_at, annotations, outside_geofence, lat, lng )`,
    )
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function loadTeam() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, active, team_id')
    .order('full_name');
  return data ?? [];
}
