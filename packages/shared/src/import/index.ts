// Import CSV de chantiers et de clients (section 11, intégrations V1) : modèle de fichier,
// correspondance des colonnes à l'écran, contrôle ligne par ligne avant toute écriture.
import { normalizeFrenchPhone } from '../phone';
import { WORK_TYPES, type WorkType } from '../statuses';

export const IMPORT_FIELDS = [
  'reference',
  'client_nom',
  'client_telephone',
  'client_email',
  'adresse',
  'date_debut',
  'date_fin',
  'types_travaux',
  'devis',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_LABELS: Record<ImportField, string> = {
  reference: 'Référence du chantier',
  client_nom: 'Nom du client',
  client_telephone: 'Téléphone du client',
  client_email: 'E-mail du client',
  adresse: 'Adresse du chantier (obligatoire)',
  date_debut: 'Date de début',
  date_fin: 'Date de fin',
  types_travaux: 'Types de travaux',
  devis: 'Référence du devis',
};

/** Fichier modèle téléchargeable : en-têtes et une ligne d'exemple (chantier d'exemple). */
export function importTemplateCsv(): string {
  return `\uFEFF${IMPORT_FIELDS.join(';')}\r\nCH-2026-010;M. et Mme Guérin;06 39 98 01 10;guerin.demo@example.com;14 Rue des Ajoncs 44400 Rezé;16/11/2026;18/11/2026;PAC air/eau, combles;DEV-2026-0150\r\n`;
}

/** Lecture d'un CSV : séparateur « ; », « , » ou tabulation, guillemets, BOM, fins de ligne. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', ',', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const HEADER_ALIASES: Record<ImportField, string[]> = {
  reference: ['reference', 'ref', 'reference chantier', 'numero chantier', 'chantier'],
  client_nom: ['client nom', 'client', 'nom client', 'nom', 'beneficiaire'],
  client_telephone: ['client telephone', 'telephone', 'tel', 'portable', 'mobile'],
  client_email: ['client email', 'email', 'e mail', 'mail', 'courriel'],
  adresse: ['adresse', 'adresse chantier', 'adresse des travaux', 'lieu'],
  date_debut: ['date debut', 'debut', 'date de debut', 'date travaux', 'date'],
  date_fin: ['date fin', 'fin', 'date de fin'],
  types_travaux: ['types travaux', 'type travaux', 'travaux', 'operations', 'operation'],
  devis: ['devis', 'reference devis', 'numero devis'],
};

/** Correspondance proposée à l'écran : pour chaque colonne, le champ reconnu (ou null). */
export function guessMapping(headers: readonly string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const n = norm(h);
    const field = IMPORT_FIELDS.find((f) => !used.has(f) && HEADER_ALIASES[f].includes(n)) ?? null;
    if (field) used.add(field);
    return field;
  });
}

const WORK_ALIASES: Record<string, WorkType> = {
  pac: 'pac_air_eau',
  'pac air eau': 'pac_air_eau',
  'pompe a chaleur': 'pac_air_eau',
  'pompe a chaleur air eau': 'pac_air_eau',
  'bar th 171': 'pac_air_eau',
  combles: 'combles',
  'isolation des combles': 'combles',
  'combles perdus': 'combles',
  'bar en 101': 'combles',
  murs: 'murs',
  'isolation des murs': 'murs',
  vmc: 'vmc',
  biomasse: 'biomasse',
  'chaudiere biomasse': 'biomasse',
  menuiseries: 'menuiseries',
  fenetres: 'menuiseries',
  photovoltaique: 'photovoltaique',
  pv: 'photovoltaique',
};

/** « PAC air/eau, combles » → ['pac_air_eau', 'combles'] ; les termes inconnus sont rendus à part. */
export function parseWorkTypes(value: string): { types: WorkType[]; unknown: string[] } {
  const types: WorkType[] = [];
  const unknown: string[] = [];
  for (const part of value.split(/[,;+|]| et /)) {
    const raw = part.trim();
    if (!raw) continue;
    const n = norm(raw);
    const code = (WORK_TYPES as readonly string[]).includes(raw)
      ? (raw as WorkType)
      : WORK_ALIASES[n];
    if (code) {
      if (!types.includes(code)) types.push(code);
    } else unknown.push(raw);
  }
  return { types, unknown };
}

/** JJ/MM/AAAA, JJ-MM-AAAA ou AAAA-MM-JJ → AAAA-MM-JJ ; null si la date n'existe pas. */
export function parseDate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (fr) [d, m, y] = [Number(fr[1]), Number(fr[2]), Number(fr[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export type ImportRow = {
  line: number;
  reference: string | null;
  client: { fullName: string; phone: string | null; email: string | null } | null;
  address: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  workTypes: WorkType[];
  quote: string | null;
};

export type ImportResult = { rows: ImportRow[]; errors: { line: number; message: string }[] };

/**
 * Lignes du fichier (sans l'en-tête) → chantiers à créer. Une ligne fautive est écartée avec
 * son motif ; les autres restent importables.
 */
export function mapRows(
  rows: readonly string[][],
  mapping: readonly (ImportField | null)[],
): ImportResult {
  const out: ImportResult = { rows: [], errors: [] };
  rows.forEach((cells, i) => {
    const line = i + 2; // ligne 1 : en-tête
    const get = (f: ImportField) => {
      const col = mapping.indexOf(f);
      return col >= 0 ? (cells[col] ?? '').trim() : '';
    };
    const problems: string[] = [];
    const address = get('adresse');
    if (!address) problems.push('adresse manquante');
    const start = get('date_debut') ? parseDate(get('date_debut')) : null;
    const end = get('date_fin') ? parseDate(get('date_fin')) : start;
    if (get('date_debut') && !start)
      problems.push(`date de début illisible (${get('date_debut')})`);
    if (get('date_fin') && !end) problems.push(`date de fin illisible (${get('date_fin')})`);
    if (start && end && end < start) problems.push('date de fin avant la date de début');
    const phoneRaw = get('client_telephone');
    const phone = phoneRaw ? normalizeFrenchPhone(phoneRaw) : null;
    if (phoneRaw && !phone) problems.push(`téléphone invalide (${phoneRaw})`);
    const email = get('client_email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      problems.push(`e-mail invalide (${email})`);
    const { types, unknown } = parseWorkTypes(get('types_travaux'));
    if (unknown.length) problems.push(`travaux inconnus : ${unknown.join(', ')}`);
    if (problems.length) {
      out.errors.push({ line, message: problems.join(' ; ') });
      return;
    }
    const name = get('client_nom');
    out.rows.push({
      line,
      reference: get('reference') || null,
      client: name ? { fullName: name, phone, email: email || null } : null,
      address,
      plannedStart: start,
      plannedEnd: end,
      workTypes: types,
      quote: get('devis') || null,
    });
  });
  return out;
}
