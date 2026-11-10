import 'server-only';
import {
  buildOperation,
  pickTemplate,
  sha256Hex,
  WORK_TYPE_TEMPLATES,
  type WorkType,
} from '@preuvio/shared';
import { palette } from '@preuvio/ui-tokens';
import sharp from 'sharp';
import { textPath } from '../exports/watermark';
import { supabaseServer } from '../supabase/server';
import { localToday } from '../today';

// Chantier de démonstration (section 15) : le chantier d'exemple (docs/chantier-exemple.md),
// déjà rempli de photos d'illustration marquées « Exemple ». Il ne compte pas dans l'essai et
// n'entre ni dans les lots, ni dans les exports, ni dans les indicateurs.

const DEMO_ADDRESS = '14 Rue des Ajoncs 44400 Rezé';
const DEMO_WORK: WorkType[] = ['pac_air_eau', 'combles'];
const light = palette('light');
const PHASE_COLOR: Record<string, string> = {
  avant: light['text-muted'],
  pendant: light.brand,
  apres: light.ok,
};

/** Illustration 1 200 × 900 : couleur de la phase, consigne de la preuve, tampon « Exemple ». */
export async function demoImage(instruction: string, phase: string): Promise<Buffer> {
  const width = 1200;
  const height = 900;
  const title = textPath(instruction, 54, width - 160);
  const stamp = textPath('EXEMPLE', 120, width);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="${PHASE_COLOR[phase] ?? light.brand}"/>` +
    `<rect x="60" y="60" width="${width - 120}" height="${height - 120}" rx="32" fill="${light.surface}" fill-opacity="0.15"/>` +
    `<path transform="translate(${(width - stamp.width) / 2} ${height / 2 - 120}) " d="${stamp.d}" fill="${light.surface}" fill-opacity="0.35"/>` +
    `<path transform="translate(80 ${height - 170})" d="${title.d}" fill="${light.surface}"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

/** Crée le chantier de démonstration de l'entreprise de l'utilisateur (une seule fois). */
export async function createDemoJobsite(userId: string, companyId: string): Promise<boolean> {
  const supabase = await supabaseServer();
  const jobsiteId = crypto.randomUUID();
  const today = localToday();
  const { error } = await supabase.from('jobsites').insert({
    id: jobsiteId,
    reference: 'DÉMO',
    address: DEMO_ADDRESS,
    lat: 47.161961,
    lng: -1.540204,
    planned_start: today,
    planned_end: today,
    status: 'in_progress',
    work_types: DEMO_WORK,
    is_demo: true,
  });
  if (error) return false;

  const { data: templates } = await supabase
    .from('checklist_templates')
    .select('id, company_id, code, version, published, valid_from, valid_to, content');
  type Slot = { id: string; instruction: string; phase: string; item_key: string };
  const slots: Slot[] = [];
  for (const workType of DEMO_WORK) {
    const code = WORK_TYPE_TEMPLATES[workType];
    const templateRow = code ? pickTemplate(templates ?? [], code, today) : null;
    if (!templateRow) continue;
    const built = buildOperation({ jobsiteId, templateRow, newId: () => crypto.randomUUID() });
    await supabase.from('jobsite_operations').insert(built.operation);
    await supabase.from('proof_slots').insert(built.slots);
    slots.push(...(built.slots as unknown as Slot[]));
  }

  // Une photo par preuve, prise « aujourd'hui » dans l'ordre avant, pendant, après.
  const order = ['avant', 'pendant', 'apres'];
  const sorted = [...slots].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
  const start = Date.now() - sorted.length * 600_000;
  const photos = await Promise.all(
    sorted.map(async (slot, i) => {
      const bytes = new Uint8Array(await demoImage(slot.instruction, slot.phase));
      const path = `${companyId}/demo/${slot.id}.jpg`;
      const upload = await supabase.storage
        .from('photos')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) return null;
      return {
        jobsite_id: jobsiteId,
        proof_slot_id: slot.id,
        author_id: userId,
        device_taken_at: new Date(start + i * 600_000).toISOString(),
        lat: 47.161961,
        lng: -1.540204,
        gps_accuracy_m: 5,
        sha256: await sha256Hex(bytes),
        original_path: path,
        thumbnail_path: path,
        upload_status: 'uploaded',
        caption: 'Photo d’exemple',
      };
    }),
  );
  await supabase.from('photos').insert(photos.filter((p) => p !== null));
  const { error: finish } = await supabase.rpc('finish_demo_jobsite', { p_jobsite: jobsiteId });
  return !finish;
}
