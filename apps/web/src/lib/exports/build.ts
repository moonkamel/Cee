import 'server-only';
import {
  manifestJson,
  metadataCsv,
  namePhotos,
  pieceFileName,
  proofTone,
  type ProofSlotStatus,
  sha256Hex,
  watermarkText,
} from '@preuvio/shared';
import { type DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import { zipSync, type Zippable } from 'fflate';
import { createElement, type ReactElement } from 'react';
import { buildPdfData, type PdfCompanyRow } from '../pdf/build';
import { ReportDocument } from '../pdf/ReportDocument';
import { downloadImages, imageOf } from '../reports';
import { supabaseServer } from '../supabase/server';
import { watermark } from './watermark';

// Dossier d'export d'un chantier (section 11) : synthese.pdf, photos/ filigranées et nommées
// selon le délégataire, pieces/, metadonnees.csv, manifest.json. Fabriqué avec la session du
// bureau, rangé dans le stockage privé, puis servi par lien signé à durée limitée.

const TONE_WORD = {
  ok: 'Validée',
  warn: 'À reprendre',
  ko: 'Manquante',
  pending: 'En analyse',
  waived: 'Dispensée',
} as const;

type SlotRow = {
  id: string;
  instruction: string;
  phase: string;
  position: number;
  required: boolean;
  applicable: boolean;
  status: ProofSlotStatus;
  jobsite_operations: { code: string } | null;
};

type PhotoRow = {
  id: string;
  proof_slot_id: string;
  author_id: string;
  device_taken_at: string;
  server_received_at: string | null;
  lat: number | null;
  lng: number | null;
  gps_accuracy_m: number | null;
  sha256: string;
  caption: string | null;
  outside_geofence: boolean;
  ai_result: unknown;
  original_path: string;
  thumbnail_path: string | null;
};

/** Petites tâches en parallèle, sans charger toutes les photos en mémoire d'un coup. */
async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function buildExport(exportId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await supabaseServer();
  const { data: exp } = await supabase
    .from('exports')
    .select('id, company_id, jobsite_ids, zip_path, delegataires ( name, naming_pattern )')
    .eq('id', exportId)
    .maybeSingle<{
      id: string;
      company_id: string;
      jobsite_ids: string[];
      zip_path: string | null;
      delegataires: { name: string; naming_pattern: string } | null;
    }>();
  if (!exp) return { ok: false, error: 'Export introuvable' };
  if (exp.zip_path) return { ok: true };
  const fail = async (error: string) => {
    await supabase.from('exports').update({ status: 'failed', error }).eq('id', exp.id);
    return { ok: false, error };
  };
  await supabase.from('exports').update({ status: 'building', error: null }).eq('id', exp.id);

  try {
    const jobsiteId = exp.jobsite_ids[0]!;
    const [{ data: jobsite }, { data: photos }, { data: docs }, { data: people }] =
      await Promise.all([
        supabase
          .from('jobsites')
          .select(
            `id, reference, address, planned_start, planned_end, quote_reference,
             clients ( full_name ),
             jobsite_operations ( code, label ),
             proof_slots ( id, instruction, phase, position, required, applicable, status,
               jobsite_operations ( code ) ),
             companies ( name, siret, address, brand_color, rge_qualifications, logo_path )`,
          )
          .eq('id', jobsiteId)
          .maybeSingle(),
        supabase
          .from('photos')
          .select(
            `id, proof_slot_id, author_id, device_taken_at, server_received_at, lat, lng,
             gps_accuracy_m, sha256, caption, outside_geofence, ai_result, original_path, thumbnail_path`,
          )
          .eq('jobsite_id', jobsiteId)
          .eq('source', 'camera')
          .not('proof_slot_id', 'is', null)
          .is('deleted_at', null)
          .order('device_taken_at')
          .returns<PhotoRow[]>(),
        supabase
          .from('jobsite_documents')
          .select('id, kind, file_path, file_name')
          .eq('jobsite_id', jobsiteId)
          .is('deleted_at', null)
          .order('created_at'),
        supabase.from('profiles').select('id, full_name'),
      ]);
    if (!jobsite) return fail('Chantier introuvable');
    const company = jobsite.companies as unknown as PdfCompanyRow & { logo_path: string | null };
    const slots = (jobsite.proof_slots as unknown as SlotRow[]).filter((s) => s.applicable);
    const slotById = new Map(slots.map((s) => [s.id, s]));
    // Preuves des emplacements applicables seulement : une preuve masquée n'entre pas au dossier.
    const proofPhotos = (photos ?? []).filter((p) => slotById.has(p.proof_slot_id));
    const client = (jobsite.clients as unknown as { full_name: string } | null)?.full_name ?? null;
    const authors = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));

    const files: Zippable = {};
    const entries: { path: string; bytes: Uint8Array }[] = [];
    const add = (path: string, bytes: Uint8Array, compress = false) => {
      files[path] = [bytes, { level: compress ? 6 : 0 }];
      entries.push({ path, bytes });
    };

    // Photos : copie filigranée de l'original, nommée selon la règle du délégataire.
    const names = namePhotos(
      exp.delegataires?.naming_pattern ?? '',
      { reference: jobsite.reference, client },
      proofPhotos.map((p) => ({
        id: p.id,
        fiche: slotById.get(p.proof_slot_id)?.jobsite_operations?.code ?? null,
        phase: slotById.get(p.proof_slot_id)?.phase ?? null,
        takenAt: p.device_taken_at,
      })),
    );
    const missingFiles: string[] = [];
    await inBatches(proofPhotos, 3, async (p) => {
      const { data } = await supabase.storage.from('photos').download(p.original_path);
      if (!data) {
        missingFiles.push(names.get(p.id)!);
        return;
      }
      const original = new Uint8Array(await data.arrayBuffer());
      const text = watermarkText({
        takenAt: p.device_taken_at,
        address: jobsite.address,
        company: company.name,
      });
      // Format illisible par la bibliothèque d'images : copie sans filigrane plutôt que rien.
      const copy = imageOf(original) ? new Uint8Array(await watermark(original, text)) : original;
      add(`photos/${names.get(p.id)}`, copy);
    });
    if (missingFiles.length) return fail(`Photo pas encore envoyée : ${missingFiles.join(', ')}`);

    // PV de réception signé (section 12) : joint aux pièces, mentionné dans la synthèse.
    const { data: signature } = await supabase
      .from('signatures')
      .select('signed_at, signer_name, has_reserves, reserves, pdf_path')
      .eq('jobsite_id', jobsiteId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (signature?.pdf_path) {
      const { data: pvFile } = await supabase.storage
        .from('documents')
        .download(signature.pdf_path);
      if (!pvFile) return fail('PV signé illisible');
      add('pieces/pv_reception.pdf', new Uint8Array(await pvFile.arrayBuffer()));
    }

    // Pièces administratives.
    const counters = new Map<string, number>();
    for (const d of docs ?? []) {
      const { data } = await supabase.storage.from('documents').download(d.file_path);
      if (!data) return fail(`Pièce illisible : ${d.file_name}`);
      const n = (counters.get(d.kind) ?? 0) + 1;
      counters.set(d.kind, n);
      add(
        `pieces/${pieceFileName(d.kind, n, d.file_name)}`,
        new Uint8Array(await data.arrayBuffer()),
      );
    }

    // synthese.pdf : fiche chantier, preuves avec vignettes, équipements, PV.
    const [thumbs, logos] = await Promise.all([
      downloadImages(
        'photos',
        proofPhotos.map((p) => ({ id: p.id, path: p.thumbnail_path ?? p.original_path })),
      ),
      company.logo_path
        ? downloadImages('documents', [{ id: 'logo', path: company.logo_path }])
        : Promise.resolve(new Map()),
    ]);
    const data = buildPdfData({
      report: {
        id: exp.id,
        kind: 'completion',
        version: 1,
        period: null,
        created_at: new Date().toISOString(),
        content: null,
      },
      jobsite: jobsite as never,
      company,
      photos: proofPhotos.map((p) => ({
        ...p,
        proof_slots: { instruction: slotById.get(p.proof_slot_id)!.instruction },
      })),
      notes: [],
      images: thumbs,
      logo: logos.get('logo') ?? null,
      verifyUrl: '',
      qrDataUrl: '',
      issuedAt: new Date().toISOString(),
      signature,
    });
    // Mêmes numéros que la grille de vignettes : ordre de prise de vue.
    const order = [...proofPhotos]
      .sort((a, b) => a.device_taken_at.localeCompare(b.device_taken_at))
      .map((p) => p.proof_slot_id);
    const phases = ['avant', 'pendant', 'apres'];
    data.title = `Synthèse du dossier${exp.delegataires ? ` · ${exp.delegataires.name}` : ''}`;
    data.sections = [];
    data.proofs = [...slots]
      .sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase) || a.position - b.position)
      .map((s) => {
        const tone = proofTone(s.status);
        return {
          label: `${s.instruction}${s.required ? '' : ' (facultative)'}`,
          status: TONE_WORD[tone],
          ok: tone === 'ok' || tone === 'waived',
          photos: order.flatMap((slotId, i) => (slotId === s.id ? [i + 1] : [])),
        };
      });
    const pdf = await renderToBuffer(
      createElement(ReportDocument, { data }) as unknown as ReactElement<DocumentProps>,
    );
    add('synthese.pdf', new Uint8Array(pdf));

    // metadonnees.csv puis manifest.json (empreintes de tous les autres fichiers).
    add(
      'metadonnees.csv',
      new TextEncoder().encode(
        metadataCsv(
          proofPhotos.map((p) => ({
            file: `photos/${names.get(p.id)}`,
            takenAt: p.device_taken_at,
            receivedAt: p.server_received_at,
            lat: p.lat,
            lng: p.lng,
            accuracyM: p.gps_accuracy_m,
            author: authors.get(p.author_id) ?? '',
            sha256: p.sha256,
          })),
        ),
      ),
      true,
    );
    const hashed = await Promise.all(
      entries.map(async (e) => ({
        path: e.path,
        sha256: await sha256Hex(e.bytes),
        size: e.bytes.length,
      })),
    );
    add(
      'manifest.json',
      new TextEncoder().encode(
        manifestJson(hashed, {
          reference: jobsite.reference,
          generatedAt: new Date().toISOString(),
        }),
      ),
      true,
    );

    const zip = zipSync(files);
    const path = `${exp.company_id}/exports/${exp.id}.zip`;
    const upload = await supabase.storage
      .from('documents')
      .upload(path, zip, { contentType: 'application/zip', upsert: false });
    if (upload.error) return fail(`ZIP non enregistré : ${upload.error.message}`);
    const { error } = await supabase
      .from('exports')
      .update({
        status: 'ready',
        zip_path: path,
        zip_sha256: await sha256Hex(zip),
        zip_size: zip.length,
      })
      .eq('id', exp.id);
    if (error) return fail(`Export non mis à jour : ${error.message}`);
    // Le chantier passe à « exporté » (section 5), sauf s'il est déjà contrôlé.
    await supabase
      .from('jobsites')
      .update({ status: 'exported' })
      .eq('id', jobsiteId)
      .in('status', ['completed_by_installer', 'verified_by_office']);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
