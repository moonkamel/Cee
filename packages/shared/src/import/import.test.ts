import { describe, expect, it } from 'vitest';
import {
  guessMapping,
  IMPORT_FIELDS,
  importTemplateCsv,
  mapRows,
  parseCsv,
  parseDate,
  parseWorkTypes,
} from './index';

describe('lecture du CSV', () => {
  it('point-virgule, guillemets, BOM, fins de ligne Windows, lignes vides', () => {
    expect(parseCsv('\uFEFFa;b;c\r\n1;"deux; et ""trois""";\r\n\r\n4;5;6')).toEqual([
      ['a', 'b', 'c'],
      ['1', 'deux; et "trois"', ''],
      ['4', '5', '6'],
    ]);
  });

  it('virgule et tabulation détectées sur l’en-tête', () => {
    expect(parseCsv('a,b\n1,"x,y"\n')).toEqual([
      ['a', 'b'],
      ['1', 'x,y'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('retour à la ligne dans une cellule entre guillemets', () => {
    expect(parseCsv('a;b\n"ligne 1\nligne 2";x')[1]).toEqual(['ligne 1\nligne 2', 'x']);
  });

  it('le modèle téléchargeable se relit et se reconnaît', () => {
    const [header, example] = parseCsv(importTemplateCsv());
    expect(guessMapping(header!)).toEqual([...IMPORT_FIELDS]);
    expect(mapRows([example!], guessMapping(header!)).errors).toEqual([]);
  });
});

describe('correspondance des colonnes', () => {
  it('reconnaît les en-têtes courants, sans prendre deux fois le même champ', () => {
    expect(
      guessMapping([
        'Réf.',
        'Nom',
        'Téléphone',
        'Adresse des travaux',
        'Date',
        'Fin',
        'Travaux',
        'Commentaire',
        'Client',
      ]),
    ).toEqual([
      'reference',
      'client_nom',
      'client_telephone',
      'adresse',
      'date_debut',
      'date_fin',
      'types_travaux',
      null,
      null,
    ]);
  });
});

describe('valeurs', () => {
  it('dates françaises et ISO, dates impossibles refusées', () => {
    expect(parseDate('9/11/2026')).toBe('2026-11-09');
    expect(parseDate('09-11-2026')).toBe('2026-11-09');
    expect(parseDate('2026-11-09')).toBe('2026-11-09');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('demain')).toBeNull();
  });

  it('types de travaux par code ou par libellé', () => {
    expect(parseWorkTypes('PAC air/eau, Isolation des combles + pac')).toEqual({
      types: ['pac_air_eau', 'combles'],
      unknown: [],
    });
    expect(parseWorkTypes('vmc et piscine')).toEqual({ types: ['vmc'], unknown: ['piscine'] });
    expect(parseWorkTypes('photovoltaique;menuiseries')).toEqual({
      types: ['photovoltaique', 'menuiseries'],
      unknown: [],
    });
  });
});

describe('lignes → chantiers', () => {
  const mapping = [...IMPORT_FIELDS];
  const row = (over: Partial<Record<(typeof IMPORT_FIELDS)[number], string>> = {}) =>
    IMPORT_FIELDS.map(
      (f) =>
        over[f] ??
        {
          reference: 'CH-1',
          client_nom: 'Mme Dupont',
          client_telephone: '06 39 98 01 02',
          client_email: '',
          adresse: '3 chemin du Moulin 69290 Craponne',
          date_debut: '16/11/2026',
          date_fin: '',
          types_travaux: 'combles',
          devis: '',
        }[f],
    );

  it('ligne correcte : client, dates (fin = début si absente), travaux', () => {
    expect(mapRows([row()], mapping)).toEqual({
      errors: [],
      rows: [
        {
          line: 2,
          reference: 'CH-1',
          client: { fullName: 'Mme Dupont', phone: '+33639980102', email: null },
          address: '3 chemin du Moulin 69290 Craponne',
          plannedStart: '2026-11-16',
          plannedEnd: '2026-11-16',
          workTypes: ['combles'],
          quote: null,
        },
      ],
    });
  });

  it('lignes fautives écartées avec leur motif, les autres gardées', () => {
    const result = mapRows(
      [
        row({ adresse: '', client_telephone: '12', client_email: 'pas-un-mail' }),
        row({ date_debut: '20/11/2026', date_fin: '18/11/2026', types_travaux: 'piscine' }),
        row({ date_debut: '32/01/2026', date_fin: 'x' }),
        row({ client_nom: '' }),
      ],
      mapping,
    );
    expect(result.errors).toEqual([
      {
        line: 2,
        message: 'adresse manquante ; téléphone invalide (12) ; e-mail invalide (pas-un-mail)',
      },
      { line: 3, message: 'date de fin avant la date de début ; travaux inconnus : piscine' },
      { line: 4, message: 'date de début illisible (32/01/2026) ; date de fin illisible (x)' },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.client).toBeNull();
  });

  it('colonnes non reliées : champs vides', () => {
    const r = mapRows([['8 allée des Tilleuls 69500 Bron']], ['adresse']);
    expect(r.rows[0]).toMatchObject({ reference: null, plannedStart: null, workTypes: [] });
  });
});
