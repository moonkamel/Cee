import { pathFromUrl } from '../push';

jest.mock('expo-notifications', () => ({}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));

describe('lien d’une notification', () => {
  it('ouvre l’écran de l’appli, rien d’autre', () => {
    expect(pathFromUrl('preuvio://jobsite/j1/camera?slot=s1')).toBe('/jobsite/j1/camera?slot=s1');
    expect(pathFromUrl('preuvio://')).toBe('/');
    expect(pathFromUrl('https://exemple.fr')).toBeNull();
    expect(pathFromUrl(42)).toBeNull();
  });
});
