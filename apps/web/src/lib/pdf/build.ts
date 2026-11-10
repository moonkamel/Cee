// Données du PDF à partir des lignes lues avec la session du bureau (RLS) : pur, testé.
import {
  equipmentFrom,
  formatParis,
  missingProofs,
  parseContent,
  photoNumbers,
  REPORT_SECTIONS,
  REPORT_TITLES,
  type ReportKind,
  SECTION_TITLES,
} from '@preuvio/shared';
import { CONTRAST, contrastRatio, palette } from '@preuvio/ui-tokens';
import type { PdfImage, ReportPdfData } from './ReportDocument';

export type ReportRow = {
  id: string;
  kind: ReportKind;
  version: number;
  period: string | null;
  content: unknown;
  created_at: string;
};

export type PdfJobsiteRow = {
  reference: string | null;
  address: string;
  planned_start: string | null;
  planned_end: string | null;
  quote_reference: string | null;
  clients: { full_name: string } | null;
  jobsite_operations: { code: string; label: string }[];
  proof_slots: {
    instruction: string;
    required: boolean;
    applicable: boolean;
    status: string;
    phase: string;
    position: number;
  }[];
};

export type PdfCompanyRow = {
  name: string;
  siret: string | null;
  address: string | null;
  brand_color: string | null;
  rge_qualifications: unknown;
};

export type PdfPhotoRow = {
  id: string;
  device_taken_at: string;
  server_received_at: string | null;
  lat: number | null;
  lng: number | null;
  gps_accuracy_m: number | null;
  sha256: string;
  caption: string | null;
  outside_geofence: boolean;
  ai_result: unknown;
  proof_slots: { instruction: string; phase?: string | null } | null;
};

export type PdfNoteRow = {
  id: string;
  created_at: string;
  transcript: string | null;
  transcript_clean: string | null;
};

const PV_PENDING = 'Le PV de réception signé par le client sera joint dès sa signature.';

export type PdfSignatureRow = {
  signed_at: string;
  signer_name: string;
  has_reserves: boolean;
  reserves: string | null;
};

/** Mention du PV de réception (section 12) : signé, avec ou sans réserves, sinon à venir. */
export function pvMention(signature: PdfSignatureRow | null | undefined): string {
  if (!signature) return PV_PENDING;
  return `PV signé le ${formatParis(signature.signed_at)} par ${signature.signer_name}, ${
    signature.has_reserves ? `avec réserves : ${signature.reserves ?? ''}` : 'sans réserve'
  }. Signature électronique simple ; le PV signé est rangé dans le dossier du chantier.`;
}

function rgeLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q) => {
    const r = q as { organisme?: string; numero?: string; domaines?: string[] };
    const head = [r.organisme, r.numero].filter(Boolean).join(' ');
    if (!head) return [];
    return [r.domaines?.length ? `${head} (${r.domaines.join(', ')})` : head];
  });
}

/** Couleur de l'entreprise si elle reste lisible sur fond blanc, sinon la couleur de marque. */
export function companyColor(color: string | null): string {
  const fallback = palette('light').brand;
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) return fallback;
  return contrastRatio(color, '#FFFFFF') >= CONTRAST.text ? color : fallback;
}

function dates(start: string | null, end: string | null): string {
  const f = (d: string) => formatParis(`${d}T12:00:00Z`, false);
  if (!start && !end) return 'non précisées';
  if (!start || !end || start === end) return f((start ?? end)!);
  return `du ${f(start)} au ${f(end)}`;
}

export function buildPdfData(input: {
  report: ReportRow;
  jobsite: PdfJobsiteRow;
  company: PdfCompanyRow;
  photos: PdfPhotoRow[];
  notes: PdfNoteRow[];
  images: Map<string, PdfImage>;
  logo: PdfImage | null;
  verifyUrl: string;
  qrDataUrl: string;
  issuedAt: string;
  signature?: PdfSignatureRow | null;
}): ReportPdfData {
  const { report, jobsite, company } = input;
  const content = parseContent(report.content, report.kind);
  const photos = [...input.photos].sort((a, b) =>
    a.device_taken_at.localeCompare(b.device_taken_at),
  );
  const notes = [...input.notes]
    .filter((n) => (n.transcript_clean ?? n.transcript ?? '').trim())
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photoOrder = photos.map((p) => p.id);
  const noteOrder = notes.map((n) => n.id);
  const label = (p: PdfPhotoRow) => p.proof_slots?.instruction ?? p.caption ?? 'Photo libre';

  return {
    title: REPORT_TITLES[report.kind],
    version: report.version,
    period: report.period,
    issuedAt: input.issuedAt,
    company: {
      name: company.name,
      siret: company.siret,
      address: company.address,
      rge: rgeLines(company.rge_qualifications),
      color: companyColor(company.brand_color),
      logo: input.logo,
    },
    jobsite: {
      reference: jobsite.reference,
      client: jobsite.clients?.full_name ?? null,
      address: jobsite.address,
      dates: dates(jobsite.planned_start, jobsite.planned_end),
      operations: jobsite.jobsite_operations.map((o) => `${o.code} · ${o.label}`),
      quote: jobsite.quote_reference,
    },
    sections: REPORT_SECTIONS.map((key) => ({
      title: SECTION_TITLES[key],
      sentences: content.sections[key].map((sentence) => ({
        text: sentence.text,
        photos: photoNumbers(sentence.photo_ids, photoOrder),
        notes: photoNumbers(sentence.note_ids, noteOrder),
      })),
    })),
    equipment:
      report.kind === 'dispute'
        ? []
        : equipmentFrom(
            photos.map((p) => ({
              label: label(p),
              ai_result: p.ai_result,
              phase: p.proof_slots?.phase ?? null,
            })),
          ),
    missing: report.kind === 'dispute' ? null : missingProofs(jobsite.proof_slots),
    pv: report.kind === 'completion' ? pvMention(input.signature) : null,
    photos: photos.map((p, i) => ({
      n: i + 1,
      label: label(p),
      takenAt: p.device_taken_at,
      receivedAt: p.server_received_at,
      lat: p.lat,
      lng: p.lng,
      accuracyM: p.gps_accuracy_m,
      sha256: p.sha256,
      outsideGeofence: p.outside_geofence,
      image: input.images.get(p.id) ?? null,
    })),
    notes: notes.map((n, i) => ({
      n: i + 1,
      recordedAt: n.created_at,
      text: (n.transcript_clean ?? n.transcript ?? '').trim(),
    })),
    verifyUrl: input.verifyUrl,
    qrDataUrl: input.qrDataUrl,
  };
}
