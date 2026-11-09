// Rédaction des rapports par l'IA (section 9, S13). L'IA reçoit uniquement les transcriptions,
// les légendes et les résultats d'analyse des photos du chantier ; elle renvoie un JSON dont
// chaque phrase cite les photos ou notes qui la justifient. Une phrase sans justification
// valable est écartée. La mise en page n'est jamais laissée à l'IA (gabarit PDF fixe).
// Fichier recopié pour les Edge Functions (voir deno-copy.ts) : imports relatifs « ./ » seulement.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import {
  type ReportContent,
  type ReportKind,
  type ReportSection,
  type ReportSentence,
} from './report-content';

export * from './report-content';

export const REPORT_MODEL = 'claude-sonnet-5-5';

// --- Ce que reçoit l'IA ---------------------------------------------------------------------

export type SourcePhoto = {
  id: string;
  takenAt: string;
  phase: string | null;
  /** Consigne de l'emplacement de preuve (null : photo libre). */
  slotLabel: string | null;
  caption: string | null;
  aiStatus: string | null;
  /** Données lues sur une plaque ou une étiquette (marque, modèle, numéro de série…). */
  extracted: Record<string, string | null> | null;
  aiReasons: string[];
  outsideGeofence: boolean;
};

export type SourceNote = { id: string; recordedAt: string; text: string };

export type ReportSource = {
  kind: ReportKind;
  /** Jour couvert (compte rendu du jour), au format AAAA-MM-JJ. */
  period: string | null;
  operations: string[];
  photos: SourcePhoto[];
  notes: SourceNote[];
};

export type SourceRef = { kind: 'photo' | 'note'; id: string };

/** Ligne photos (avec son emplacement de preuve) telle que lue par le serveur. */
export type PhotoRow = {
  id: string;
  device_taken_at: string;
  caption: string | null;
  outside_geofence: boolean | null;
  ai_status: string | null;
  ai_result: unknown;
  proof_slots?: { instruction: string; phase: string } | null;
};

type StoredAiResult = {
  verdict?: {
    checks?: { pass?: boolean; reason?: string }[];
    extracted?: Record<string, string | null>;
  };
  decision?: { kind?: string };
};

/** Photo → faits remis à l'IA : verdict du pré-contrôle, remarques, données de plaque. */
export function photoSource(row: PhotoRow): SourcePhoto {
  const ai = (row.ai_result ?? {}) as StoredAiResult;
  return {
    id: row.id,
    takenAt: row.device_taken_at,
    phase: row.proof_slots?.phase ?? null,
    slotLabel: row.proof_slots?.instruction ?? null,
    caption: row.caption,
    aiStatus: ai.decision?.kind ?? (row.ai_status === 'done' ? null : row.ai_status),
    extracted: ai.verdict?.extracted ?? null,
    aiReasons: (ai.verdict?.checks ?? [])
      .filter((c) => c.pass === false && c.reason)
      .map((c) => c.reason!),
    outsideGeofence: row.outside_geofence === true,
  };
}

export type NoteRow = {
  id: string;
  created_at: string;
  transcript: string | null;
  transcript_clean: string | null;
};

/** Note → texte remis à l'IA (nettoyé si possible) ; une note pas encore transcrite est ignorée. */
export function noteSource(row: NoteRow): SourceNote | null {
  const text = (row.transcript_clean ?? row.transcript ?? '').trim();
  return text ? { id: row.id, recordedAt: row.created_at, text } : null;
}

/** Références courtes (P1, N1) : l'IA ne manipule jamais d'identifiant technique. */
export function sourceRefs(source: ReportSource): Map<string, SourceRef> {
  const refs = new Map<string, SourceRef>();
  [...source.photos]
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .forEach((p, i) => refs.set(`P${i + 1}`, { kind: 'photo', id: p.id }));
  [...source.notes]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .forEach((n, i) => refs.set(`N${i + 1}`, { kind: 'note', id: n.id }));
  return refs;
}

const KIND_GOAL: Record<ReportKind, string> = {
  daily: 'Compte rendu de la journée pour le dirigeant et le chef d’équipe.',
  completion: 'Rapport de fin de chantier pour le bureau.',
  dispute: 'Dossier de litige factuel pour un client, un assureur ou un expert.',
};

/** Texte remis à l'IA : uniquement les données du chantier, sans nom ni coordonnées du client. */
export function buildReportPrompt(source: ReportSource): string {
  const refs = sourceRefs(source);
  const byId = new Map([...refs].map(([ref, r]) => [r.id, ref]));
  const lines = [
    `Rapport : ${KIND_GOAL[source.kind]}`,
    source.period ? `Journée : ${source.period}` : null,
    `Opérations : ${source.operations.join(' ; ') || 'non précisées'}`,
    '',
    'Photos :',
    ...[...source.photos]
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
      .map((p) => {
        const facts = [
          p.takenAt,
          p.phase ? `phase ${p.phase}` : 'photo libre',
          p.slotLabel ? `preuve « ${p.slotLabel} »` : null,
          p.caption ? `légende « ${p.caption} »` : null,
          p.aiStatus ? `pré-contrôle ${p.aiStatus}` : null,
          ...p.aiReasons.map((r) => `remarque « ${r} »`),
          ...Object.entries(p.extracted ?? {})
            .filter(([, v]) => v)
            .map(([k, v]) => `${k} : ${v}`),
          p.outsideGeofence ? 'prise hors du chantier' : null,
        ].filter(Boolean);
        return `${byId.get(p.id)} — ${facts.join(' ; ')}`;
      }),
    '',
    'Notes vocales :',
    ...[...source.notes]
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map((n) => `${byId.get(n.id)} — ${n.recordedAt} — « ${n.text} »`),
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export const REPORT_SYSTEM_PROMPT = [
  'Tu rédiges un rapport de chantier de rénovation énergétique, en français sobre et factuel.',
  'Tu n’utilises que les photos (P1, P2…) et les notes vocales (N1, N2…) fournies. N’invente rien :',
  'aucune quantité, marque, date ou conformité qui ne figure pas dans les données.',
  'Chaque phrase porte dans refs les références qui la justifient (au moins une).',
  'summary : 1 à 3 phrases sur l’essentiel. works : les travaux réalisés et équipements posés.',
  'reserves : défauts, éléments manquants ou réserves signalés. attention : ce que le bureau doit',
  'vérifier (pré-contrôle en alerte, photo hors chantier, problème dicté). Liste vide si rien.',
  'Tu ne juges jamais la conformité réglementaire du chantier.',
].join('\n');

// --- Ce que renvoie l'IA ----------------------------------------------------------------------

const draftSentence = z.object({ text: z.string(), refs: z.array(z.string()) });
export const reportDraftSchema = z.object({
  summary: z.array(draftSentence),
  works: z.array(draftSentence),
  reserves: z.array(draftSentence),
  attention: z.array(draftSentence),
});
export type ReportDraft = z.infer<typeof reportDraftSchema>;

/** Garde les phrases justifiées par des références existantes, traduites en identifiants. */
export function finalizeDraft(
  draft: ReportDraft,
  source: ReportSource,
  writtenBy: string,
): ReportContent {
  const refs = sourceRefs(source);
  let dropped = 0;
  const section = (sentences: ReportDraft[ReportSection]): ReportSentence[] =>
    sentences.flatMap((s) => {
      const found = [...new Set(s.refs.map((r) => r.trim().toUpperCase()))]
        .map((r) => refs.get(r))
        .filter((r): r is SourceRef => r !== undefined);
      const text = s.text.trim();
      if (!text || found.length === 0) {
        dropped += 1;
        return [];
      }
      return [
        {
          text,
          photo_ids: found.filter((r) => r.kind === 'photo').map((r) => r.id),
          note_ids: found.filter((r) => r.kind === 'note').map((r) => r.id),
        },
      ];
    });
  return {
    kind: source.kind,
    period: source.period,
    photo_ids: source.photos.map((p) => p.id),
    note_ids: source.notes.map((n) => n.id),
    sections: {
      summary: section(draft.summary),
      works: section(draft.works),
      reserves: section(draft.reserves),
      attention: section(draft.attention),
    },
    written_by: writtenBy,
    dropped,
  };
}

/** Rapport sans donnée à résumer : aucun appel à l'IA. */
export function emptyContent(source: ReportSource): ReportContent {
  return finalizeDraft({ summary: [], works: [], reserves: [], attention: [] }, source, 'aucun');
}

// --- Rédacteurs -------------------------------------------------------------------------------

export type WriteResult =
  | { ok: true; draft: ReportDraft; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; kind: 'retry' | 'refused' | 'invalid'; message: string };

export interface ReportWriter {
  write(source: ReportSource): Promise<WriteResult>;
}

export function createClaudeReportWriter({
  client,
  model = REPORT_MODEL,
}: {
  client: Anthropic;
  model?: string;
}): ReportWriter {
  return {
    async write(source): Promise<WriteResult> {
      try {
        const response = await client.messages.parse({
          model,
          max_tokens: 8192,
          output_config: { effort: 'medium', format: zodOutputFormat(reportDraftSchema) },
          system: REPORT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildReportPrompt(source) }],
        });
        if (response.stop_reason === 'refusal') {
          return { ok: false, kind: 'refused', message: 'rédaction déclinée par le modèle' };
        }
        if (!response.parsed_output) {
          return {
            ok: false,
            kind: 'invalid',
            message: `réponse illisible (${response.stop_reason})`,
          };
        }
        return {
          ok: true,
          draft: response.parsed_output,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (error) {
        if (
          error instanceof Anthropic.RateLimitError ||
          error instanceof Anthropic.InternalServerError ||
          error instanceof Anthropic.APIConnectionError ||
          error instanceof Anthropic.AuthenticationError
        ) {
          return { ok: false, kind: 'retry', message: error.message };
        }
        return { ok: false, kind: 'invalid', message: String(error) };
      }
    },
  };
}

/** Rédacteur factice (tests, CI) : une phrase par photo et par note, toujours justifiée. */
export function createFakeReportWriter(): ReportWriter {
  return {
    async write(source) {
      const refs = sourceRefs(source);
      const byId = new Map([...refs].map(([ref, r]) => [r.id, ref]));
      const works = source.photos
        .filter((p) => p.slotLabel)
        .map((p) => ({ text: `${p.slotLabel} : photo prise.`, refs: [byId.get(p.id)!] }));
      const attention = [
        ...source.photos
          .filter((p) => p.aiStatus === 'retake' || p.aiStatus === 'review' || p.outsideGeofence)
          .map((p) => ({ text: 'Photo à vérifier par le bureau.', refs: [byId.get(p.id)!] })),
        ...source.notes.map((n) => ({ text: n.text, refs: [byId.get(n.id)!] })),
      ];
      const first = [...refs.keys()][0];
      return {
        ok: true,
        draft: {
          summary: first
            ? [
                {
                  text: `${source.photos.length} photo(s), ${source.notes.length} note(s).`,
                  refs: [first],
                },
              ]
            : [],
          works,
          reserves: [],
          attention,
        },
        model: 'fake',
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}
