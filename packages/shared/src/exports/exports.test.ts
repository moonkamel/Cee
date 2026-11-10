import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NAMING_PATTERN,
  DEFAULT_REQUIRED_DOCUMENTS,
  exportChecks,
  isIncomplete,
  manifestJson,
  jobsitesCsv,
  metadataCsv,
  namePhotos,
  pieceFileName,
  requiredDocuments,
  safeFilePart,
  validatePattern,
  watermarkText,
} from './index';

describe('pièces exigées', () => {
  it('celles du délégataire, sinon les quatre par défaut', () => {
    expect(requiredDocuments(['facture', 'devis', 'facture', 'inconnue'])).toEqual([
      'facture',
      'devis',
    ]);
    expect(requiredDocuments([])).toEqual(DEFAULT_REQUIRED_DOCUMENTS);
    expect(requiredDocuments(null)).toEqual(['devis', 'facture', 'attestation', 'offre_cee']);
  });
});

describe('règles de nommage', () => {
  it('valide un modèle', () => {
    expect(validatePattern(DEFAULT_NAMING_PATTERN)).toEqual([]);
    expect(validatePattern('{REF}_{N}')).toEqual(['Champ inconnu : {REF}']);
    expect(validatePattern('{FICHE_{N}')).toContain('Accolade non fermée');
    expect(validatePattern('a/{N}')).toEqual(['Pas de dossier dans le nom']);
    expect(validatePattern('  ')).toEqual(['Modèle vide']);
  });

  it('nettoie les caractères gênants', () => {
    expect(safeFilePart('M. et Mme Guérin / Rezé')).toBe('M._et_Mme_Guerin_Reze');
  });

  it('numérote par fiche et étape, dans l’ordre de prise, sans doublon', () => {
    const names = namePhotos(
      DEFAULT_NAMING_PATTERN,
      { reference: 'CH-2026-001', client: 'Guérin' },
      [
        { id: 'b', fiche: 'BAR-TH-171', phase: 'avant', takenAt: '2026-11-09T09:00:00Z' },
        { id: 'a', fiche: 'BAR-TH-171', phase: 'avant', takenAt: '2026-11-09T08:00:00Z' },
        { id: 'c', fiche: 'BAR-EN-101', phase: 'apres', takenAt: '2026-11-11T08:00:00Z' },
        { id: 'd', fiche: null, phase: null, takenAt: '2026-11-10T08:00:00Z' },
      ],
    );
    expect(Object.fromEntries(names)).toEqual({
      a: 'CH-2026-001_BAR-TH-171_AVANT_01.jpg',
      b: 'CH-2026-001_BAR-TH-171_AVANT_02.jpg',
      d: 'CH-2026-001_DIVERS_DIVERS_01.jpg',
      c: 'CH-2026-001_BAR-EN-101_APRES_01.jpg',
    });
  });

  it('modèle sans {N} ni extension : suffixe et .jpg ajoutés ; modèle invalide : celui par défaut', () => {
    const photos = [
      { id: 'a', fiche: 'X', phase: 'avant', takenAt: '2026-11-09T08:00:00Z' },
      { id: 'b', fiche: 'X', phase: 'avant', takenAt: '2026-11-09T09:00:00Z' },
    ];
    const names = namePhotos('{CLIENT}_{DATE}', { reference: null, client: 'Guérin' }, photos);
    expect([...names.values()]).toEqual(['Guerin_20261109.jpg', 'Guerin_20261109_2.jpg']);
    const fallback = namePhotos('{OUPS}', { reference: null, client: null }, photos);
    expect(fallback.get('a')).toBe('CHANTIER_X_AVANT_01.jpg');
  });
});

describe('vérification avant export', () => {
  const slot = { instruction: 'Façade', required: true, applicable: true, status: 'compliant' };
  const docs = [
    { kind: 'offre_cee', document_date: '2026-10-01' },
    { kind: 'devis', document_date: '2026-10-05' },
    { kind: 'attestation', document_date: null },
    { kind: 'facture', document_date: '2026-11-15' },
  ];
  const base = {
    slots: [slot],
    documents: docs,
    required: DEFAULT_REQUIRED_DOCUMENTS,
    worksStart: '2026-11-09',
    worksEnd: '2026-11-11',
    rge: [{ organisme: 'Qualit’EnR', date_fin: '2027-12-31' }],
  };

  it('dossier complet : vert, RGE à vérifier pour le domaine', () => {
    const checks = exportChecks(base);
    expect(checks.map((c) => [c.key, c.status])).toEqual([
      ['proofs', 'ok'],
      ['documents', 'ok'],
      ['dates', 'ok'],
      ['rge', 'warn'],
    ]);
    expect(isIncomplete(checks)).toBe(false);
  });

  it('manques : rouge, export « incomplet »', () => {
    const checks = exportChecks({
      ...base,
      slots: [
        { ...slot, instruction: 'Plaque', status: 'missing' },
        { ...slot, instruction: 'Masquée', status: 'missing', applicable: false },
        { ...slot, instruction: 'Facultative', status: 'missing', required: false },
      ],
      documents: docs.filter((d) => d.kind !== 'facture'),
      rge: [],
    });
    expect(checks.find((c) => c.key === 'proofs')).toMatchObject({
      status: 'ko',
      detail: '1 manquante(s) : Plaque',
    });
    expect(checks.find((c) => c.key === 'documents')!.detail).toBe('Manque : Facture');
    expect(checks.find((c) => c.key === 'rge')!.detail).toBe('Aucune qualification RGE renseignée');
    expect(isIncomplete(checks)).toBe(true);
  });

  it('dates dans le désordre ou inconnues : avertissement, pas de blocage', () => {
    const disorder = exportChecks({
      ...base,
      documents: docs.map((d) => (d.kind === 'devis' ? { ...d, document_date: '2026-11-20' } : d)),
    });
    expect(disorder.find((c) => c.key === 'dates')).toMatchObject({
      status: 'warn',
      detail:
        'À vérifier : début des travaux avant devis, fin des travaux avant devis, facture avant devis',
    });
    const unknown = exportChecks({ ...base, worksStart: null, worksEnd: null });
    expect(unknown.find((c) => c.key === 'dates')!.detail).toBe(
      'Date inconnue : début des travaux, fin des travaux',
    );
    expect(isIncomplete(disorder)).toBe(false);
  });

  it('RGE échue à la date des travaux', () => {
    const checks = exportChecks({
      ...base,
      rge: [{ date_fin: '2026-06-30' }, { numero: 'sans date' }],
    });
    expect(checks.find((c) => c.key === 'rge')).toMatchObject({ status: 'ko' });
  });
});

describe('fichiers du ZIP', () => {
  it('filigrane : date et heure de Paris, adresse, entreprise', () => {
    expect(
      watermarkText({
        takenAt: '2026-11-09T15:10:00Z',
        address: '14 Rue des Ajoncs 44400 Rezé',
        company: 'Proofeo',
      }),
    ).toBe('09/11/2026 16:10 · 14 Rue des Ajoncs 44400 Rezé · Proofeo');
    expect(watermarkText({ takenAt: 'x', address: 'A', company: 'B' })).toBe('A · B');
  });

  it('metadonnees.csv lisible dans un tableur français', () => {
    const csv = metadataCsv([
      {
        file: 'photos/a.jpg',
        takenAt: '2026-11-09T15:10:05Z',
        receivedAt: '2026-11-09T15:11:00Z',
        lat: 47.161961,
        lng: -1.540204,
        accuracyM: 6.4,
        author: 'Jean "le poseur"; Durand',
        sha256: 'ab',
      },
      {
        file: 'photos/b.jpg',
        takenAt: '2026-11-09T15:12:00Z',
        receivedAt: null,
        lat: null,
        lng: null,
        accuracyM: null,
        author: 'X',
        sha256: 'cd',
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      '\uFEFFfichier;date;heure;recue_le;latitude;longitude;precision_m;auteur;sha256',
    );
    expect(lines[1]).toBe(
      'photos/a.jpg;09/11/2026;16:10:05;09/11/2026 16:11:00;47.161961;-1.540204;6;"Jean ""le poseur""; Durand";ab',
    );
    expect(lines[2]).toBe('photos/b.jpg;09/11/2026;16:12:00;;;;;X;cd');
  });

  it('manifeste trié, avec l’algorithme', () => {
    const json = JSON.parse(
      manifestJson(
        [
          { path: 'synthese.pdf', sha256: 'b', size: 2 },
          { path: 'photos/a.jpg', sha256: 'a', size: 1 },
        ],
        { reference: 'CH-1', generatedAt: '2026-11-11T00:00:00Z' },
      ),
    );
    expect(json.algorithm).toBe('SHA-256');
    expect(json.files.map((f: { path: string }) => f.path)).toEqual([
      'photos/a.jpg',
      'synthese.pdf',
    ]);
  });

  it('nom des pièces', () => {
    expect(pieceFileName('devis', 1, 'Devis signé.PDF')).toBe('devis_1.pdf');
    expect(pieceFileName('autre', 2, 'sans-extension')).toBe('autre_2.pdf');
  });
});

describe('liste des chantiers (export complet)', () => {
  it('une ligne par chantier, client et opérations', () => {
    const csv = jobsitesCsv([
      {
        reference: 'CH-2026-003',
        address: '14 Rue des Ajoncs 44400 Rezé',
        status: 'exported',
        planned_start: '2026-11-09',
        planned_end: '2026-11-11',
        quote_reference: null,
        created_at: '2026-11-08T10:00:00Z',
        clients: { full_name: 'M. et Mme Guérin', phone: '+33639980110', email: null },
        jobsite_operations: [{ code: 'BAR-TH-171' }, { code: 'BAR-EN-101' }],
        photos: [{ id: 'a' }, { id: 'b' }],
      },
      {
        reference: null,
        address: 'Lieu-dit; "Le Bourg"',
        status: 'planned',
        planned_start: null,
        planned_end: null,
        quote_reference: 'DEV-1',
        created_at: '2026-11-09T10:00:00Z',
        clients: null,
        jobsite_operations: null,
        photos: null,
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      '\uFEFFreference;adresse;statut;debut_prevu;fin_prevue;devis;cree_le;client;telephone;email;operations;photos',
    );
    expect(lines[1]).toBe(
      'CH-2026-003;14 Rue des Ajoncs 44400 Rezé;exported;2026-11-09;2026-11-11;;2026-11-08;M. et Mme Guérin;+33639980110;;BAR-TH-171 BAR-EN-101;2',
    );
    expect(lines[2]).toBe(';"Lieu-dit; ""Le Bourg""";planned;;;DEV-1;2026-11-09;;;;;0');
  });
});
