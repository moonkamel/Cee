import 'server-only';
import type { InspectionResult } from '@preuvio/shared';
import { supabaseServer } from './supabase/server';

// Lots CEE (section 10), lus avec la session du bureau : la RLS réserve les lots au chef
// d'équipe (lecture), au bureau, à l'admin et au dirigeant.

export type BatchListRow = {
  id: string;
  operation_code: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  alert_level: string;
  delegataires: { name: string } | null;
  inspections: { result: InspectionResult }[];
  cee_batch_jobsites: { jobsite_id: string }[];
};

export async function currentThreshold(): Promise<number> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('cee_thresholds')
    .select('year, max_nonconformity_rate')
    .lte('year', new Date().getFullYear())
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.max_nonconformity_rate ?? 0.14);
}

export async function loadBatches() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('cee_batches')
    .select(
      'id, operation_code, period_start, period_end, status, alert_level, delegataires ( name ), inspections ( result ), cee_batch_jobsites ( jobsite_id )',
    )
    .order('created_at', { ascending: false })
    .returns<BatchListRow[]>();
  return data ?? [];
}

export type BatchJobsite = {
  id: string;
  reference: string | null;
  quote_reference: string | null;
  address: string;
  status: string;
  planned_end: string | null;
  jobsite_operations: { code: string }[];
  proof_slots: {
    id: string;
    item_key: string;
    instruction: string;
    applicable: boolean;
    status: string;
  }[];
};

export type BatchInspection = {
  id: string;
  jobsite_id: string;
  kind: string;
  body: string | null;
  inspected_on: string;
  result: InspectionResult;
  findings: string | null;
  corrected_on: string | null;
  correction_planned_at: string | null;
};

const JOBSITE_SELECT = `id, reference, quote_reference, address, status, planned_end,
  jobsite_operations ( code ), proof_slots ( id, item_key, instruction, applicable, status )`;

export async function loadBatch(id: string) {
  const supabase = await supabaseServer();
  const { data: batch } = await supabase
    .from('cee_batches')
    .select(
      'id, operation_code, period_start, period_end, status, alert_level, delegataire_id, delegataires ( name )',
    )
    .eq('id', id)
    .maybeSingle<{
      id: string;
      operation_code: string;
      period_start: string | null;
      period_end: string | null;
      status: string;
      alert_level: string;
      delegataire_id: string | null;
      delegataires: { name: string } | null;
    }>();
  if (!batch) return null;
  const [{ data: links }, { data: inspections }, { data: all }] = await Promise.all([
    supabase.from('cee_batch_jobsites').select('jobsite_id').eq('batch_id', id),
    supabase
      .from('inspections')
      .select(
        'id, jobsite_id, kind, body, inspected_on, result, findings, corrected_on, correction_planned_at',
      )
      .eq('batch_id', id)
      .order('inspected_on', { ascending: false })
      .returns<BatchInspection[]>(),
    supabase
      .from('jobsites')
      .select(JOBSITE_SELECT)
      .eq('is_demo', false)
      .order('planned_end', { ascending: false })
      .returns<BatchJobsite[]>(),
  ]);
  const inBatch = new Set((links ?? []).map((l) => l.jobsite_id));
  return {
    batch,
    jobsites: (all ?? []).filter((j) => inBatch.has(j.id)),
    others: (all ?? []).filter((j) => !inBatch.has(j.id)),
    inspections: inspections ?? [],
  };
}
