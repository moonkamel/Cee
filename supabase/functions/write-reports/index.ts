// Rédaction des rapports (section 9, S13), lancée chaque minute par pg_cron tant que la file
// « report_generation » n'est pas vide. Réservé à la clé de service.
//
// Pour chaque demande : données du chantier (photos, légendes, analyses, notes transcrites),
// rédaction par Claude, contrôle des références, puis première version de la série en base.
// Le PDF est composé ensuite par le web, quand le bureau l'ouvre. Erreur passagère : nouvel
// essai ; après 5, la demande est archivée.

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  createClaudeReportWriter,
  createFakeReportWriter,
  emptyContent,
  finalizeDraft,
  type NoteRow,
  noteSource,
  type PhotoRow,
  photoSource,
  type ReportKind,
  type ReportSource,
  type ReportWriter,
} from '../_shared/ai/report.ts';
import { json } from '../_shared/http.ts';
import { isServiceCall } from '../_shared/service.ts';

const BATCH = 3;
const VISIBILITY_S = 600;
const MAX_ATTEMPTS = 5;

type ReportRequest = {
  jobsite_id: string;
  kind: ReportKind;
  period?: string;
  photo_ids?: string[];
};
type Message = { msg_id: number; read_ct: number; message: ReportRequest };
type Outcome = { jobsite_id: string; kind: string; result: string };

/** Destinataires de la notification « rapport prêt » (tableau de la section 9). */
const RECIPIENT_ROLES: Record<ReportKind, string[]> = {
  daily: ['owner', 'lead'],
  completion: ['owner', 'admin', 'office'],
  dispute: ['owner', 'admin', 'office'],
};
const TITLES: Record<ReportKind, string> = {
  daily: 'Compte rendu du jour',
  completion: 'Rapport de fin de chantier',
  dispute: 'Dossier de litige',
};

function writerFromEnv(): ReportWriter | null {
  if (Deno.env.get('AI_PROVIDER') === 'fake') return createFakeReportWriter();
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  return key ? createClaudeReportWriter({ client: new Anthropic({ apiKey: key }) }) : null;
}

/** Bornes UTC d'une journée de Paris (le compte rendu couvre la journée locale). */
function parisDay(day: string): { from: string; to: string } {
  const probe = new Date(`${day}T12:00:00Z`);
  const local = new Date(probe.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const offsetMs = local.getTime() - probe.getTime();
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - offsetMs);
  return { from: start.toISOString(), to: new Date(start.getTime() + 86_400_000).toISOString() };
}

async function loadSource(db: SupabaseClient, req: ReportRequest) {
  const { data: jobsite } = await db
    .from('jobsites')
    .select('id, company_id, reference, jobsite_operations ( code, label )')
    .eq('id', req.jobsite_id)
    .maybeSingle();
  if (!jobsite) return null;

  let photos = db
    .from('photos')
    .select(
      'id, device_taken_at, caption, outside_geofence, ai_status, ai_result, proof_slots ( instruction, phase )',
    )
    .eq('jobsite_id', jobsite.id)
    .is('deleted_at', null)
    .order('device_taken_at');
  let notes = db
    .from('voice_notes')
    .select('id, created_at, transcript, transcript_clean')
    .eq('jobsite_id', jobsite.id)
    .is('deleted_at', null)
    .order('created_at');
  if (req.kind === 'daily' && req.period) {
    const { from, to } = parisDay(req.period);
    photos = photos.gte('device_taken_at', from).lt('device_taken_at', to);
    notes = notes.gte('created_at', from).lt('created_at', to);
  }
  if (req.kind === 'dispute') {
    photos = photos.in('id', req.photo_ids ?? []);
    // Un dossier de litige ne reprend que les notes dictées sur les photos choisies.
    notes = notes.in('photo_id', req.photo_ids ?? []);
  }
  const [{ data: photoRows }, { data: noteRows }] = await Promise.all([photos, notes]);
  const operations = (jobsite.jobsite_operations as { code: string; label: string }[]) ?? [];
  const source: ReportSource = {
    kind: req.kind,
    period: req.kind === 'daily' ? (req.period ?? null) : null,
    operations: operations.map((o) => `${o.code} ${o.label}`),
    photos: ((photoRows ?? []) as unknown as PhotoRow[]).map(photoSource),
    notes: ((noteRows ?? []) as NoteRow[]).flatMap((n) => noteSource(n) ?? []),
  };
  return { jobsite, source };
}

async function handle(db: SupabaseClient, writer: ReportWriter, m: Message): Promise<Outcome> {
  const req = m.message;
  const out = (result: string) => ({ jobsite_id: req.jobsite_id, kind: req.kind, result });
  const done = async (result: string) => {
    await db.rpc('report_queue_delete', { id: m.msg_id });
    return out(result);
  };
  if (m.read_ct > MAX_ATTEMPTS) {
    await db.rpc('report_queue_archive', { id: m.msg_id });
    return out('échec, archivé');
  }
  const loaded = await loadSource(db, req);
  if (!loaded) return done('chantier inconnu');
  const { jobsite, source } = loaded;

  // Compte rendu déjà rédigé pour ce jour (nouvel essai après coupure) : rien à refaire.
  if (req.kind === 'daily') {
    const { count } = await db
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('jobsite_id', jobsite.id)
      .eq('kind', 'daily')
      .eq('period', req.period);
    if (count) return done('déjà rédigé');
  }

  let content = emptyContent(source);
  if (source.photos.length + source.notes.length > 0) {
    const { data: allowed } = await db.rpc('ai_quota_take', { p_company: jobsite.company_id });
    if (!allowed) {
      await db.rpc('report_queue_delay', { id: m.msg_id, seconds: 3600 });
      return out('quota atteint');
    }
    const result = await writer.write(source);
    if (!result.ok) {
      if (result.kind === 'retry') return out(`nouvel essai : ${result.message}`);
      // Refus ou réponse illisible : rapport sans texte, le bureau le rédige à la main.
      content = { ...emptyContent(source), written_by: `échec : ${result.message}` };
    } else {
      content = finalizeDraft(result.draft, source, result.model);
      await db.rpc('ai_usage_add_tokens', {
        p_company: jobsite.company_id,
        p_input: result.inputTokens,
        p_output: result.outputTokens,
      });
    }
  }

  const { data: report, error } = await db
    .from('reports')
    .insert({
      company_id: jobsite.company_id,
      jobsite_id: jobsite.id,
      kind: req.kind,
      period: source.period,
      version: 1,
      content,
    })
    .select('id')
    .single();
  if (error || !report) return out(`enregistrement impossible : ${error?.message}`);

  const { data: recipients } = await db
    .from('profiles')
    .select('id')
    .eq('company_id', jobsite.company_id)
    .eq('active', true)
    .in('role', RECIPIENT_ROLES[req.kind]);
  if (recipients?.length) {
    await db.from('notifications').insert(
      recipients.map((r) => ({
        company_id: jobsite.company_id,
        recipient_id: r.id,
        kind: 'report_ready',
        payload: {
          title: TITLES[req.kind],
          body: `${jobsite.reference ?? 'Chantier'} : rapport prêt à relire`,
          jobsite_id: jobsite.id,
          report_id: report.id,
        },
      })),
    );
  }
  return done(`rédigé (${content.dropped} phrase(s) écartée(s))`);
}

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json(403, { error: 'Réservé au serveur' });
  const writer = writerFromEnv();
  // Sans clé, rien ne se perd : les demandes attendent dans la file.
  if (!writer) return json(503, { error: 'ANTHROPIC_API_KEY absente' });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: messages, error } = await db.rpc('report_queue_read', {
    batch: BATCH,
    visibility_s: VISIBILITY_S,
  });
  if (error) return json(500, { error: error.message });

  const outcomes: Outcome[] = [];
  for (const m of (messages ?? []) as Message[]) {
    try {
      outcomes.push(await handle(db, writer, m));
    } catch (e) {
      outcomes.push({
        jobsite_id: m.message.jobsite_id,
        kind: m.message.kind,
        result: `erreur : ${e instanceof Error ? e.message : e}`,
      });
    }
  }
  return json(200, { processed: outcomes.length, outcomes });
});
