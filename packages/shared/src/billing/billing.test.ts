import { describe, expect, it } from 'vitest';
import {
  accessBanner,
  canWrite,
  companyAccess,
  companySearchUrl,
  hasFeature,
  isPlan,
  normalizeSiret,
  orderWorkTypes,
  parseCompanySearch,
  parseRgeLines,
  priceLabel,
  rgeSearchUrl,
  seatLimit,
} from '.';

const now = '2026-11-10T10:00:00Z';
const base = {
  plan: 'trial',
  trialEndsAt: '2026-12-10T10:00:00Z',
  jobsites: 3,
  subscription: null,
  now,
};

describe('offres', () => {
  it('prix affichés, annuel avec deux mois offerts', () => {
    expect(priceLabel('solo', 'month')).toBe('39 € HT par mois');
    expect(priceLabel('team', 'year')).toBe('990 € HT par an');
    expect(priceLabel('enterprise', 'month')).toBe('Sur devis');
    expect([isPlan('team'), isPlan('trial')]).toEqual([true, false]);
  });
});

describe('essai et accès', () => {
  it('essai : jours et chantiers restants, tout est ouvert', () => {
    const a = companyAccess(base);
    expect(a).toEqual({ kind: 'trial', daysLeft: 30, jobsitesLeft: 7 });
    expect([canWrite(a), hasFeature(a, 'marketing'), seatLimit(a)]).toEqual([true, true, 10]);
    expect(accessBanner(a)).toBe('Essai gratuit : 30 jour(s) et 7 chantier(s) restants');
  });

  it('10e chantier ou date passée : lecture seule 90 jours, puis fermé', () => {
    const tenth = companyAccess({ ...base, jobsites: 10 });
    expect(tenth).toEqual({
      kind: 'read_only',
      reason: 'trial_ended',
      until: '2027-02-08T10:00:00.000Z',
    });
    expect(canWrite(tenth)).toBe(false);
    expect(seatLimit(tenth)).toBe(0);
    expect(accessBanner(tenth)).toContain(
      'Essai terminé : vos données restent consultables jusqu’au 08/02/2027',
    );
    expect(companyAccess({ ...base, trialEndsAt: '2026-11-01T10:00:00Z' })).toMatchObject({
      kind: 'read_only',
      until: '2027-01-30T10:00:00.000Z',
    });
    expect(companyAccess({ ...base, trialEndsAt: '2026-08-01T10:00:00Z' })).toEqual({
      kind: 'closed',
    });
    expect(accessBanner({ kind: 'closed' })).toContain('Accès fermé');
    expect(companyAccess({ ...base, trialEndsAt: null })).toMatchObject({ kind: 'read_only' });
  });

  it('abonnée : selon l’offre ; impayé : encore actif ; résiliée : lecture seule', () => {
    const sub = { status: 'active', plan: 'solo', currentPeriodEnd: '2026-12-01T00:00:00Z' };
    const solo = companyAccess({ ...base, jobsites: 50, subscription: sub });
    expect(solo).toEqual({ kind: 'active', plan: 'solo' });
    expect([hasFeature(solo, 'batches'), seatLimit(solo), accessBanner(solo)]).toEqual([
      false,
      2,
      null,
    ]);
    const team = companyAccess({
      ...base,
      subscription: { ...sub, plan: 'team', status: 'past_due' },
    });
    expect(hasFeature(team, 'marketing')).toBe(true);
    expect(
      seatLimit(companyAccess({ ...base, subscription: { ...sub, plan: 'enterprise' } })),
    ).toBeNull();
    const canceled = companyAccess({
      ...base,
      subscription: { ...sub, status: 'canceled', currentPeriodEnd: '2026-11-01T00:00:00Z' },
    });
    expect(canceled).toMatchObject({ kind: 'read_only', reason: 'canceled' });
    expect(hasFeature(canceled, 'batches')).toBe(false);
    expect(accessBanner(canceled)).toContain('Abonnement arrêté');
    expect(
      companyAccess({
        ...base,
        subscription: { ...sub, status: 'canceled', currentPeriodEnd: null },
      }),
    ).toMatchObject({ kind: 'read_only' });
  });
});

describe('SIRET', () => {
  it('14 chiffres et clé de Luhn', () => {
    expect(normalizeSiret('418 166 096 00069')).toBe('41816609600069');
    expect(normalizeSiret('41816609600068')).toBeNull();
    expect(normalizeSiret('1234')).toBeNull();
    expect(normalizeSiret('35600000000010')).toBe('35600000000010');
    expect(normalizeSiret('35600000000011')).toBeNull();
  });

  it('recherche d’entreprise : établissement du SIRET, nom remis en forme', () => {
    expect(companySearchUrl('41816609600069')).toContain('q=41816609600069');
    const body = {
      results: [
        {
          nom_complet: 'ENERGIE ET FILS',
          nom_raison_sociale: 'ENERGIE ET FILS',
          siege: { siret: '11111111111111', adresse: 'ailleurs' },
          matching_etablissements: [
            {
              siret: '41816609600069',
              adresse: '3 ALLEE VERTE 44000 NANTES',
              etat_administratif: 'A',
            },
          ],
        },
      ],
    };
    expect(parseCompanySearch(body, '41816609600069')).toEqual({
      name: 'Energie Et Fils',
      address: '3 ALLEE VERTE 44000 NANTES',
      active: true,
    });
    const siege = {
      results: [
        { nom_complet: 'Proofeo', siege: { siret: '22222222222222', etat_administratif: 'F' } },
      ],
    };
    expect(parseCompanySearch(siege, '22222222222222')).toEqual({
      name: 'Proofeo',
      address: null,
      active: false,
    });
    expect(parseCompanySearch(siege, '33333333333333')).toBeNull();
    expect(parseCompanySearch({ results: [{ siege: { siret: '1' } }] }, '1')).toBeNull();
    expect(parseCompanySearch(null, '1')).toBeNull();
  });
});

describe('liste RGE de l’ADEME', () => {
  it('une qualification par organisme et domaine', () => {
    expect(rgeSearchUrl('41816609600069')).toContain('siret_eq=41816609600069');
    expect(
      parseRgeLines({
        results: [
          {
            organisme: 'Qualit’EnR',
            nom_qualification: 'QualiPAC',
            code_qualification: 'QPAC/1',
            lien_date_fin: '2027-06-30T00:00:00',
          },
          { organisme: 'Qualit’EnR', nom_qualification: 'QualiPAC' },
          { organisme: '', nom_qualification: 'x' },
          { organisme: 'Qualibat', nom_qualification: 'Isolation' },
        ],
      }),
    ).toEqual([
      { organisme: 'Qualit’EnR', numero: 'QPAC/1', domaine: 'QualiPAC', dateFin: '2027-06-30' },
      { organisme: 'Qualibat', numero: null, domaine: 'Isolation', dateFin: null },
    ]);
    expect(parseRgeLines(undefined)).toEqual([]);
  });
});

describe('métiers exercés', () => {
  it('passent en tête des tuiles', () => {
    expect(orderWorkTypes(['pac_air_eau', 'combles', 'vmc'], ['vmc'])).toEqual([
      'vmc',
      'pac_air_eau',
      'combles',
    ]);
  });
});
