'use server';

import {
  buildOperation,
  DOCUMENT_KINDS,
  type DocumentKind,
  type ImportField,
  IMPORT_FIELDS,
  mapRows,
  parseCsv,
  parseGeocodingResponse,
  permissions,
  pickTemplate,
  safeFilePart,
  searchAddressUrl,
  validatePattern,
  WORK_TYPE_TEMPLATES,
} from '@preuvio/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/dal';
import { trackServer } from '@/lib/telemetry';
import { loadCandidates, loadDelegataires } from '@/lib/exports/queries';
import { supabaseServer } from '@/lib/supabase/server';
import { localToday } from '@/lib/today';
import type { FormState } from './actions';

// Exports délégataires, pièces et import CSV (section 11) : bureau, admin et dirigeant.

async function officeOnly() {
  const user = await currentUser();
  if (!permissions(user.role).export) throw new Error('Réservé au bureau et au dirigeant');
  return user;
}

/** Lance un export par chantier coché ; la vérification du moment est gardée avec l'export. */
export async function createExports(_: FormState, form: FormData): Promise<FormState> {
  await officeOnly();
  const ids = form.getAll('jobsiteId').map(String).filter(Boolean);
  if (ids.length === 0) return { error: 'Cochez au moins un chantier' };
  const delegataireId = String(form.get('delegataireId') ?? '') || null;
  const delegataire = (await loadDelegataires()).find((d) => d.id === delegataireId) ?? null;
  const candidates = (await loadCandidates(delegataire)).filter((c) => ids.includes(c.id));
  const batch = crypto.randomUUID();
  const supabase = await supabaseServer();
  const { error } = await supabase.from('exports').insert(
    candidates.map((c) => ({
      batch_id: batch,
      jobsite_ids: [c.id],
      delegataire_id: delegataire?.id ?? null,
      checks: c.checks,
      incomplete: c.checks.some((k) => k.status === 'ko'),
    })),
  );
  if (error) return { error: 'Export refusé' };
  const user = await currentUser();
  await trackServer('export_created', `user:${user.id}`, {
    jobsites: candidates.length,
    incomplete: candidates.filter((c) => c.checks.some((k) => k.status === 'ko')).length,
  });
  redirect(`/exports?lot=${batch}`);
}

/** Lien de téléchargement à durée limitée envoyé par e-mail (Edge Function, clé Brevo). */
export async function sendExportLink(_: FormState, form: FormData): Promise<FormState> {
  await officeOnly();
  const email = String(form.get('email') ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse e-mail invalide' };
  const supabase = await supabaseServer();
  const { error } = await supabase.functions.invoke('send-export-link', {
    body: { export_id: String(form.get('exportId') ?? ''), email },
  });
  if (error) return { error: 'Envoi impossible pour le moment' };
  revalidatePath('/exports');
  return { ok: true };
}

export async function saveDelegataire(_: FormState, form: FormData): Promise<FormState> {
  await officeOnly();
  const name = String(form.get('name') ?? '').trim();
  const pattern = String(form.get('pattern') ?? '').trim();
  const required = form.getAll('required').map(String) as DocumentKind[];
  if (!name) return { error: 'Nom du délégataire requis' };
  const errors = validatePattern(pattern);
  if (errors.length) return { error: errors.join(' ; ') };
  if (required.some((k) => !DOCUMENT_KINDS.includes(k))) return { error: 'Pièce inconnue' };
  const row = { name, naming_pattern: pattern, required_documents: required };
  const id = String(form.get('id') ?? '');
  const supabase = await supabaseServer();
  const { error } = id
    ? await supabase.from('delegataires').update(row).eq('id', id)
    : await supabase.from('delegataires').insert(row);
  if (error) return { error: 'Délégataire non enregistré' };
  revalidatePath('/delegataires');
  return { ok: true };
}

/** Pièce administrative (devis signé, facture…) : fichier dans le stockage privé, puis la ligne. */
export async function addDocument(_: FormState, form: FormData): Promise<FormState> {
  const user = await officeOnly();
  const file = form.get('file');
  const jobsiteId = String(form.get('jobsiteId') ?? '');
  const kind = String(form.get('kind') ?? '') as DocumentKind;
  if (!(file instanceof File) || file.size === 0) return { error: 'Choisissez un fichier' };
  if (file.size > 4 * 1024 * 1024) return { error: 'Fichier trop lourd (4 Mo au plus)' };
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
    return { error: 'PDF, JPEG ou PNG seulement' };
  }
  if (!DOCUMENT_KINDS.includes(kind)) return { error: 'Type de pièce inconnu' };
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  const path = `${profile!.company_id}/pieces/${jobsiteId}/${crypto.randomUUID()}-${safeFilePart(file.name)}`;
  const upload = await supabase.storage
    .from('documents')
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type });
  if (upload.error) return { error: 'Fichier non enregistré' };
  const { error } = await supabase.from('jobsite_documents').insert({
    jobsite_id: jobsiteId,
    kind,
    file_path: path,
    file_name: file.name,
    label: String(form.get('label') ?? '').trim() || null,
    document_date: String(form.get('date') ?? '') || null,
  });
  if (error) return { error: 'Pièce non enregistrée' };
  revalidatePath(`/chantiers/${jobsiteId}`);
  return { ok: true };
}

/** Retrait logique : la pièce sort des exports, le fichier reste conservé. */
export async function removeDocument(form: FormData) {
  await officeOnly();
  const supabase = await supabaseServer();
  await supabase
    .from('jobsite_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', String(form.get('documentId') ?? ''));
  revalidatePath(`/chantiers/${String(form.get('jobsiteId') ?? '')}`);
}

export type ImportState = {
  error?: string;
  created?: { line: number; label: string; address: string; located: boolean }[];
  rejected?: { line: number; message: string }[];
} | null;

/** Adresse BAN la plus probable (service public, sans clé) ; null si introuvable. */
async function geocode(address: string) {
  try {
    const res = await fetch(searchAddressUrl(address, undefined, 1), {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? (parseGeocodingResponse(await res.json())[0] ?? null) : null;
  } catch {
    return null;
  }
}

/** Import CSV : contrôle des lignes, géocodage, chantier et checklist comme la création rapide. */
export async function importJobsites(_: ImportState, form: FormData): Promise<ImportState> {
  await officeOnly();
  const rows = parseCsv(String(form.get('csv') ?? ''));
  const mapping = JSON.parse(String(form.get('mapping') ?? '[]')) as (ImportField | null)[];
  if (rows.length < 2) return { error: 'Fichier vide' };
  if (!mapping.includes('adresse')) return { error: 'Reliez la colonne de l’adresse' };
  if (mapping.some((m) => m !== null && !IMPORT_FIELDS.includes(m)))
    return { error: 'Champ inconnu' };
  if (rows.length > 201) return { error: '200 chantiers au plus par fichier' };
  const { rows: valid, errors } = mapRows(rows.slice(1), mapping);

  const supabase = await supabaseServer();
  const { data: templates } = await supabase
    .from('checklist_templates')
    .select('id, company_id, code, version, published, valid_from, valid_to, content');
  const created: NonNullable<ImportState>['created'] = [];
  const rejected = [...errors];
  for (const row of valid) {
    const place = await geocode(row.address);
    let clientId: string | null = null;
    if (row.client) {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          full_name: row.client.fullName,
          phone: row.client.phone,
          email: row.client.email,
          address: place?.label ?? row.address,
          ban_id: place?.banId ?? null,
          lat: place?.lat ?? null,
          lng: place?.lng ?? null,
        })
        .select('id')
        .single();
      if (error || !data) {
        rejected.push({ line: row.line, message: 'client non enregistré' });
        continue;
      }
      clientId = data.id;
    }
    const jobsiteId = crypto.randomUUID();
    const { error } = await supabase.from('jobsites').insert({
      id: jobsiteId,
      client_id: clientId,
      reference: row.reference,
      address: place?.label ?? row.address,
      ban_id: place?.banId ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      planned_start: row.plannedStart,
      planned_end: row.plannedEnd,
      status: 'planned',
      quote_reference: row.quote,
      work_types: row.workTypes,
    });
    if (error) {
      rejected.push({ line: row.line, message: 'chantier non enregistré' });
      continue;
    }
    // Checklists générées depuis les modèles, comme à la création rapide sur le téléphone.
    for (const workType of row.workTypes) {
      const code = WORK_TYPE_TEMPLATES[workType];
      const templateRow = code ? pickTemplate(templates ?? [], code, localToday()) : null;
      if (!templateRow) continue;
      const { operation, slots } = buildOperation({
        jobsiteId,
        templateRow,
        newId: () => crypto.randomUUID(),
      });
      await supabase.from('jobsite_operations').insert(operation);
      await supabase.from('proof_slots').insert(slots);
    }
    created.push({
      line: row.line,
      label: row.reference ?? row.client?.fullName ?? row.address,
      address: place?.label ?? row.address,
      located: place !== null,
    });
  }
  revalidatePath('/chantiers');
  return { created, rejected: rejected.sort((a, b) => a.line - b.line) };
}
