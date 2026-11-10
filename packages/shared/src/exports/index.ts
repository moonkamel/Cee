// Exports délégataires (section 11, S14) : nommage, vérification avant export, métadonnées,
// manifeste d'empreintes. Logique pure : le web fabrique les fichiers, ce module dit quoi y mettre.

// --- Pièces administratives -------------------------------------------------------------------

export const DOCUMENT_KINDS = ['devis', 'facture', 'attestation', 'offre_cee', 'autre'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  devis: 'Devis signé',
  facture: 'Facture',
  attestation: 'Attestation sur l’honneur',
  offre_cee: 'Offre CEE acceptée',
  autre: 'Autre pièce',
};

/** Pièces exigées quand aucun délégataire n'est choisi (ou qu'il n'en précise aucune). */
export const DEFAULT_REQUIRED_DOCUMENTS: DocumentKind[] = [
  'devis',
  'facture',
  'attestation',
  'offre_cee',
];

/** Pièces exigées par un délégataire (colonne required_documents), sinon celles par défaut. */
export function requiredDocuments(raw: unknown): DocumentKind[] {
  const kinds = Array.isArray(raw)
    ? raw.filter((k): k is DocumentKind => DOCUMENT_KINDS.includes(k as DocumentKind))
    : [];
  return kinds.length > 0 ? [...new Set(kinds)] : DEFAULT_REQUIRED_DOCUMENTS;
}

// --- Règles de nommage ------------------------------------------------------------------------

export const DEFAULT_NAMING_PATTERN = '{REF_CHANTIER}_{FICHE}_{ETAPE}_{N}.jpg';
export const NAMING_FIELDS = ['REF_CHANTIER', 'FICHE', 'ETAPE', 'N', 'CLIENT', 'DATE'] as const;
export type NamingField = (typeof NAMING_FIELDS)[number];

const ETAPE: Record<string, string> = { avant: 'AVANT', pendant: 'PENDANT', apres: 'APRES' };

/** Erreurs d'un modèle de nom, en français ; liste vide : modèle utilisable. */
export function validatePattern(pattern: string): string[] {
  const errors: string[] = [];
  if (!pattern.trim()) return ['Modèle vide'];
  for (const m of pattern.matchAll(/\{([^}]*)\}/g)) {
    if (!NAMING_FIELDS.includes(m[1] as NamingField)) errors.push(`Champ inconnu : {${m[1]}}`);
  }
  if (/[{}]/.test(pattern.replace(/\{[^{}]*\}/g, ''))) errors.push('Accolade non fermée');
  if (/[/\\]/.test(pattern)) errors.push('Pas de dossier dans le nom');
  return errors;
}

/** Caractères sûrs pour tous les systèmes : lettres sans accent, chiffres, tiret, point, souligné. */
export function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export type NamedPhoto = {
  id: string;
  fiche: string | null;
  phase: string | null;
  takenAt: string;
};

/**
 * Noms des photos d'un chantier. N compte les photos d'une même fiche et d'une même étape, dans
 * l'ordre de prise ; deux noms identiques reçoivent un suffixe : aucun fichier n'en écrase un autre.
 */
export function namePhotos(
  pattern: string,
  ctx: { reference: string | null; client: string | null },
  photos: readonly NamedPhoto[],
): Map<string, string> {
  const usable = validatePattern(pattern).length === 0 ? pattern : DEFAULT_NAMING_PATTERN;
  const counters = new Map<string, number>();
  const taken = new Set<string>();
  const names = new Map<string, string>();
  for (const p of [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt))) {
    const fiche = p.fiche ?? 'DIVERS';
    const etape = (p.phase && ETAPE[p.phase]) ?? 'DIVERS';
    const key = `${fiche}|${etape}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    const values: Record<NamingField, string> = {
      REF_CHANTIER: ctx.reference ?? 'CHANTIER',
      FICHE: fiche,
      ETAPE: etape,
      N: String(n).padStart(2, '0'),
      CLIENT: ctx.client ?? 'CLIENT',
      DATE: p.takenAt.slice(0, 10).replaceAll('-', ''),
    };
    let name = usable.replace(/\{([A-Z_]+)\}/g, (_, f: NamingField) => safeFilePart(values[f]));
    name = safeFilePart(name);
    if (!/\.jpe?g$/i.test(name)) name = `${name}.jpg`;
    let unique = name;
    for (let i = 2; taken.has(unique.toLowerCase()); i += 1) {
      unique = name.replace(/(\.jpe?g)$/i, `_${i}$1`);
    }
    taken.add(unique.toLowerCase());
    names.set(p.id, unique);
  }
  return names;
}

// --- Vérification avant export ------------------------------------------------------------------

export type CheckStatus = 'ok' | 'warn' | 'ko';
export type ExportCheck = { key: string; label: string; status: CheckStatus; detail: string };

export type CheckInput = {
  slots: readonly { instruction: string; required: boolean; applicable: boolean; status: string }[];
  documents: readonly { kind: string; document_date: string | null }[];
  required: readonly DocumentKind[];
  /** Première et dernière photo (sinon dates prévues) : période des travaux, AAAA-MM-JJ. */
  worksStart: string | null;
  worksEnd: string | null;
  rge: unknown;
};

const NEEDS_PHOTO = new Set(['missing', 'to_retake']);

function latest(docs: CheckInput['documents'], kind: DocumentKind): string | null {
  const dates = docs
    .filter((d) => d.kind === kind && d.document_date)
    .map((d) => d.document_date!)
    .sort();
  return dates.at(-1) ?? null;
}

/** Les quatre contrôles de la section 11, en vert, orange ou rouge. */
export function exportChecks(input: CheckInput): ExportCheck[] {
  const checks: ExportCheck[] = [];

  const missing = input.slots.filter(
    (s) => s.applicable && s.required && NEEDS_PHOTO.has(s.status),
  );
  checks.push({
    key: 'proofs',
    label: 'Preuves photo obligatoires',
    status: missing.length === 0 ? 'ok' : 'ko',
    detail:
      missing.length === 0
        ? 'Toutes prises'
        : `${missing.length} manquante(s) : ${missing.map((s) => s.instruction).join(', ')}`,
  });

  const absent = input.required.filter((k) => !input.documents.some((d) => d.kind === k));
  checks.push({
    key: 'documents',
    label: 'Pièces administratives',
    status: absent.length === 0 ? 'ok' : 'ko',
    detail:
      absent.length === 0
        ? 'Toutes présentes'
        : `Manque : ${absent.map((k) => DOCUMENT_LABELS[k]).join(', ')}`,
  });

  // Ordre attendu : offre CEE, devis, travaux, facture. Règle à confirmer avec chaque
  // délégataire (section 11) : un écart est signalé, il ne bloque pas.
  const offer = latest(input.documents, 'offre_cee');
  const quote = latest(input.documents, 'devis');
  const invoice = latest(input.documents, 'facture');
  const steps: [string, string | null][] = [
    ['offre CEE', offer],
    ['devis', quote],
    ['début des travaux', input.worksStart],
    ['fin des travaux', input.worksEnd],
    ['facture', invoice],
  ];
  const known = steps.filter((s): s is [string, string] => s[1] !== null);
  const disorder = known.flatMap((s, i) =>
    known
      .slice(i + 1)
      .filter((t) => t[1] < s[1])
      .map((t) => `${t[0]} avant ${s[0]}`),
  );
  checks.push({
    key: 'dates',
    label: 'Cohérence des dates',
    status: disorder.length > 0 || known.length < steps.length ? 'warn' : 'ok',
    detail:
      disorder.length > 0
        ? `À vérifier : ${disorder.join(', ')}`
        : known.length < steps.length
          ? `Date inconnue : ${steps
              .filter((s) => s[1] === null)
              .map((s) => s[0])
              .join(', ')}`
          : 'Offre CEE, devis, travaux puis facture',
  });

  const quals = (Array.isArray(input.rge) ? input.rge : []) as { date_fin?: string }[];
  const at = input.worksEnd ?? input.worksStart;
  const valid = quals.some((q) => q.date_fin && (!at || q.date_fin >= at));
  checks.push({
    key: 'rge',
    label: 'Qualification RGE',
    // Le domaine couvert par chaque fiche n'est pas encore défini : il reste à vérifier.
    status: quals.length === 0 || !valid ? 'ko' : 'warn',
    detail:
      quals.length === 0
        ? 'Aucune qualification RGE renseignée'
        : !valid
          ? 'Aucune qualification valide à la date des travaux'
          : 'Valide à la date des travaux ; domaine à vérifier',
  });
  return checks;
}

/** Un export avec au moins un contrôle rouge est marqué « incomplet ». */
export function isIncomplete(checks: readonly ExportCheck[]): boolean {
  return checks.some((c) => c.status === 'ko');
}

// --- Fichiers du ZIP ----------------------------------------------------------------------------

/** Texte du filigrane des copies d'export (jamais appliqué sur l'original, section 6). */
export function watermarkText(p: { takenAt: string; address: string; company: string }): string {
  const d = new Date(p.takenAt);
  const when = Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(d)
        .replace(',', '');
  return [when, p.address, p.company].filter(Boolean).join(' · ');
}

export type MetadataRow = {
  file: string;
  takenAt: string;
  receivedAt: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  author: string;
  sha256: string;
};

const csvCell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** metadonnees.csv : séparateur « ; » et BOM, pour une ouverture directe dans un tableur français. */
export function metadataCsv(rows: readonly MetadataRow[]): string {
  const header = [
    'fichier',
    'date',
    'heure',
    'recue_le',
    'latitude',
    'longitude',
    'precision_m',
    'auteur',
    'sha256',
  ];
  const paris = (iso: string, part: 'date' | 'time') =>
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      ...(part === 'date'
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }).format(new Date(iso));
  const lines = rows.map((r) =>
    [
      r.file,
      paris(r.takenAt, 'date'),
      paris(r.takenAt, 'time'),
      r.receivedAt ? `${paris(r.receivedAt, 'date')} ${paris(r.receivedAt, 'time')}` : '',
      r.lat?.toFixed(6) ?? '',
      r.lng?.toFixed(6) ?? '',
      r.accuracyM !== null ? String(Math.round(r.accuracyM)) : '',
      r.author,
      r.sha256,
    ]
      .map(csvCell)
      .join(';'),
  );
  return `\uFEFF${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}

/** manifest.json : empreinte de chaque fichier du ZIP (hors lui-même), triés par chemin. */
export function manifestJson(
  files: readonly { path: string; sha256: string; size: number }[],
  meta: { reference: string | null; generatedAt: string },
): string {
  return `${JSON.stringify(
    {
      format: 'preuvio-export-1',
      algorithm: 'SHA-256',
      reference: meta.reference,
      generated_at: meta.generatedAt,
      files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
    },
    null,
    2,
  )}\n`;
}

/** Nom d'une pièce dans pieces/ : type, rang, extension d'origine. */
export function pieceFileName(kind: string, index: number, originalName: string): string {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(originalName)?.[1]?.toLowerCase() ?? 'pdf';
  return `${safeFilePart(kind)}_${index}.${ext}`;
}

export type JobsiteCsvRow = {
  reference: string | null;
  address: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  quote_reference: string | null;
  created_at: string;
  clients: { full_name: string; phone: string | null; email: string | null } | null;
  jobsite_operations: { code: string }[] | null;
  photos: { id: string }[] | null;
};

/** chantiers.csv de l'export complet (section 15) : un chantier par ligne. */
export function jobsitesCsv(rows: readonly JobsiteCsvRow[]): string {
  const header = [
    'reference',
    'adresse',
    'statut',
    'debut_prevu',
    'fin_prevue',
    'devis',
    'cree_le',
    'client',
    'telephone',
    'email',
    'operations',
    'photos',
  ];
  const lines = rows.map((r) =>
    [
      r.reference ?? '',
      r.address,
      r.status,
      r.planned_start ?? '',
      r.planned_end ?? '',
      r.quote_reference ?? '',
      r.created_at.slice(0, 10),
      r.clients?.full_name ?? '',
      r.clients?.phone ?? '',
      r.clients?.email ?? '',
      (r.jobsite_operations ?? []).map((o) => o.code).join(' '),
      String((r.photos ?? []).length),
    ]
      .map(csvCell)
      .join(';'),
  );
  return `\uFEFF${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}
