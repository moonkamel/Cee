import { describe, expect, it } from 'vitest';
import {
  parseGeocodingResponse,
  pendingAddressLabel,
  reverseGeocodeUrl,
  searchAddressUrl,
} from './address';
import { QuickJobsiteError, buildQuickJobsite, type QuickJobsiteInput } from './quick-jobsite';

const ids = ['client-1', 'jobsite-1'];
const base = (): QuickJobsiteInput => {
  let i = 0;
  return {
    address: {
      label: '8 allée des Tilleuls 69500 Bron',
      banId: '69029_1',
      lat: 45.738,
      lng: 4.913,
      pending: false,
    },
    workTypes: ['pac_air_eau', 'pac_air_eau', 'vmc'],
    client: { fullName: '  M. Martin ', phone: '06 39 98 01 01' },
    today: '2026-11-09',
    userId: 'u-poseur',
    newId: () => ids[i++] ?? 'x',
  };
};

describe('buildQuickJobsite', () => {
  it('crée le client, le chantier en cours du jour et l’affectation du poseur', () => {
    const { client, jobsite, assignee } = buildQuickJobsite(base());
    expect(client).toMatchObject({ id: 'client-1', full_name: 'M. Martin', phone: '+33639980101' });
    expect(jobsite).toMatchObject({
      id: 'jobsite-1',
      client_id: 'client-1',
      status: 'in_progress',
      planned_start: '2026-11-09',
      work_types: ['pac_air_eau', 'vmc'],
    });
    expect(assignee).toEqual({ jobsite_id: 'jobsite-1', profile_id: 'u-poseur' });
  });

  it('n’envoie jamais l’entreprise ni l’auteur : le serveur les impose', () => {
    const { jobsite, client } = buildQuickJobsite(base());
    expect(jobsite).not.toHaveProperty('company_id');
    expect(jobsite).not.toHaveProperty('created_by');
    expect(client).not.toHaveProperty('company_id');
  });

  it('accepte un chantier sans client (renseigné plus tard)', () => {
    const { client, jobsite } = buildQuickJobsite({ ...base(), client: null });
    expect(client).toBeNull();
    expect(jobsite.client_id).toBeNull();
  });

  it('garde la position et marque l’adresse à compléter hors ligne', () => {
    const input = base();
    input.address = {
      label: pendingAddressLabel(45.738, 4.913),
      banId: null,
      lat: 45.738,
      lng: 4.913,
      pending: true,
    };
    const { jobsite, client } = buildQuickJobsite(input);
    expect(jobsite).toMatchObject({ _addressPending: true, lat: 45.738 });
    expect(client?.address).toBeNull();
  });

  it.each([
    [
      { address: { label: ' ', banId: null, lat: null, lng: null, pending: false } },
      'Adresse manquante',
    ],
    [{ workTypes: [] }, 'Choisissez au moins un type de travaux'],
    [{ workTypes: ['piscine'] }, 'Type de travaux inconnu'],
  ])('refuse une saisie incomplète (%#)', (patch, message) => {
    expect(() =>
      buildQuickJobsite({ ...base(), ...(patch as Partial<QuickJobsiteInput>) }),
    ).toThrow(new QuickJobsiteError(message));
  });

  it('met un numéro de client invalide à vide plutôt que de bloquer', () => {
    const { client } = buildQuickJobsite({
      ...base(),
      client: { fullName: 'Mme Dupont', phone: '123' },
    });
    expect(client?.phone).toBeNull();
  });
});

describe('adresses', () => {
  it('lit la réponse du géocodeur et ignore les entrées incomplètes', () => {
    const body = {
      type: 'FeatureCollection',
      features: [
        {
          geometry: { coordinates: [4.913, 45.738] },
          properties: { label: '8 Allée des Tilleuls 69500 Bron', id: '69029_0420_00008' },
        },
        { geometry: { coordinates: [4.9] }, properties: { label: 'Coordonnées incomplètes' } },
        { geometry: { coordinates: [4.91, 45.73] }, properties: {} },
      ],
    };
    expect(parseGeocodingResponse(body)).toEqual([
      {
        label: '8 Allée des Tilleuls 69500 Bron',
        banId: '69029_0420_00008',
        lat: 45.738,
        lng: 4.913,
      },
    ]);
    expect(parseGeocodingResponse(null)).toEqual([]);
  });

  it('construit les adresses du service et un libellé provisoire lisible', () => {
    expect(reverseGeocodeUrl(45.738, 4.913)).toBe(
      'https://data.geopf.fr/geocodage/reverse?index=address&lat=45.738&lon=4.913&limit=5',
    );
    expect(searchAddressUrl('8 allée des tilleuls bron', { lat: 45.7, lng: 4.9 })).toContain(
      'q=8+all%C3%A9e+des+tilleuls+bron',
    );
    expect(pendingAddressLabel(45.738, 4.913)).toBe(
      'Position GPS 45,7380 ; 4,9130 — adresse à compléter',
    );
  });
});
