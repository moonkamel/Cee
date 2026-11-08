import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';
import { AuthProvider, type AuthService } from '@/auth/auth';
import { DataProvider } from '@/data/data-context';
import type { CachedResult, DataSource, Jobsite, Profile } from '@/data/types';
import { localToday } from '@/lib/position';
import { ThemeProvider } from '@/theme/theme';
import TabsLayout from '../app/(tabs)/_layout';
import Today from '../app/(tabs)/index';
import Jobsites from '../app/(tabs)/jobsites';
import Me from '../app/(tabs)/me';
import JobsiteScreen from '../app/jobsite/[id]';
import LoginCode from '../app/login/code';
import LoginPhone from '../app/login/index';
import Welcome from '../app/welcome';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0' }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock est hissé avant les imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// --- Faux services -----------------------------------------------------------------------
const TODAY = localToday();
const HERE = { lat: 45.738, lng: 4.913 };

const jobsite = (over: Partial<Jobsite> & { id: string; address: string }): Jobsite => ({
  reference: null,
  status: 'planned',
  plannedStart: TODAY,
  plannedEnd: TODAY,
  lat: null,
  lng: null,
  geofenceRadiusM: 150,
  clientName: 'M. Martin',
  operations: ['PAC air/eau'],
  proofs: [
    { status: 'captured', required: true },
    { status: 'missing', required: true },
  ],
  ...over,
});

let signedInUser: string | null = null;
let listener: ((id: string | null) => void) | null = null;
const auth: jest.Mocked<AuthService> = {
  currentUserId: jest.fn(async () => signedInUser),
  onChange: jest.fn((l) => {
    listener = l;
    return () => undefined;
  }),
  sendCode: jest.fn(async (_phone: string) => undefined),
  verifyCode: jest.fn(async (_phone: string, _code: string) => {
    signedInUser = 'u-poseur';
    listener?.('u-poseur');
  }),
  signOut: jest.fn(async () => {
    signedInUser = null;
    listener?.(null);
  }),
};

let jobsites: CachedResult<Jobsite[]> = {
  data: [],
  stale: false,
  fetchedAt: new Date().toISOString(),
};
const data: jest.Mocked<DataSource> = {
  listJobsites: jest.fn(async () => jobsites),
  cachedJobsites: jest.fn(async () => null),
  getProfile: jest.fn(async (_userId: string): Promise<Profile | null> => ({
    id: 'u-poseur',
    fullName: 'Jean Poseur',
    role: 'installer' as const,
    companyName: 'Thermi Rénov',
  })),
};

function TestLayout() {
  return (
    <ThemeProvider>
      <AuthProvider service={auth}>
        <DataProvider source={data}>
          <Stack screenOptions={{ headerShown: false }} />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const routes = {
  _layout: TestLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Today,
  '(tabs)/jobsites': Jobsites,
  '(tabs)/me': Me,
  welcome: Welcome,
  'login/index': LoginPhone,
  'login/code': LoginCode,
  'jobsite/[id]': JobsiteScreen,
};

function withPosition(position: { lat: number; lng: number } | null) {
  const loc = jest.mocked(Location);
  loc.requestForegroundPermissionsAsync.mockResolvedValue({
    status: position ? 'granted' : 'denied',
  } as never);
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockResolvedValue(
    position
      ? ({ coords: { latitude: position.lat, longitude: position.lng } } as never)
      : (null as never),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  signedInUser = null;
  listener = null;
  withPosition(null);
  jobsites = { data: [], stale: false, fetchedAt: new Date().toISOString() };
});

// --- Critère de fin de S4 ------------------------------------------------------------------
describe('poseur invité', () => {
  it('voit ses chantiers du jour en trois taps maximum', async () => {
    jobsites.data = [jobsite({ id: 'j1', address: '8 allée des Tilleuls, Bron' })];
    let taps = 0;
    const tap = async (name: string) => {
      taps += 1;
      await fireEvent.press(screen.getByRole('button', { name }));
    };

    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Bienvenue sur Preuvio')).toBeTruthy();

    await tap('Commencer');
    await fireEvent.changeText(screen.getByLabelText('Numéro de portable'), '06 39 98 00 03');
    await tap('Recevoir le code');
    expect(auth.sendCode).toHaveBeenCalledWith('+33639980003');

    // Le code est proposé par le clavier du téléphone (remplissage automatique) : pas un tap d'écran.
    await fireEvent.changeText(await screen.findByLabelText('Code à 6 chiffres'), '123456');
    expect(auth.verifyCode).toHaveBeenCalledWith('+33639980003', '123456');

    expect(await screen.findByText('8 allée des Tilleuls, Bron')).toBeTruthy();
    expect(taps).toBeLessThanOrEqual(3);
  });

  it('connecté, arrive directement sur « Aujourd’hui » à l’ouverture (0 tap)', async () => {
    signedInUser = 'u-poseur';
    jobsites.data = [jobsite({ id: 'j1', address: 'Chantier du jour' })];
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Chantier du jour')).toBeTruthy();
  });
});

describe('connexion', () => {
  it('n’active « Recevoir le code » qu’avec un numéro valide', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    const button = await screen.findByRole('button', { name: 'Recevoir le code' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Numéro de portable'), '06 39 98');
    expect(
      screen.getByRole('button', { name: 'Recevoir le code' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('pré-remplit le numéro depuis le lien d’invitation', async () => {
    await renderRouter(routes, { initialUrl: '/login?phone=%2B33639980003' });
    expect((await screen.findByLabelText('Numéro de portable')).props.value).toBe('+33639980003');
  });

  it('signale un code faux et vide le champ', async () => {
    auth.verifyCode.mockRejectedValueOnce(new Error('bad'));
    await renderRouter(routes, { initialUrl: '/login/code?phone=%2B33639980003' });
    await fireEvent.changeText(await screen.findByLabelText('Code à 6 chiffres'), '000000');
    expect(await screen.findByText('Code incorrect. Réessayez.')).toBeTruthy();
    expect(screen.getByLabelText('Code à 6 chiffres').props.value).toBe('');
  });
});

describe('écran « Aujourd’hui »', () => {
  beforeEach(() => {
    signedInUser = 'u-poseur';
  });

  it('ouvre en grand le chantier dans le rayon, le plus proche en tête', async () => {
    withPosition(HERE);
    jobsites.data = [
      jobsite({ id: 'loin', address: 'Chantier lointain', lat: 45.764, lng: 4.8357 }),
      jobsite({ id: 'ici', address: 'Chantier ici', lat: HERE.lat, lng: HERE.lng }),
    ];
    await renderRouter(routes, { initialUrl: '/' });
    await waitFor(() => expect(screen.getByTestId('jobsite-card-featured')).toBeTruthy());
    const featured = within(screen.getByTestId('jobsite-card-featured'));
    expect(featured.getByText('Chantier ici')).toBeTruthy();
    expect(featured.getByText('Vous y êtes')).toBeTruthy();
    expect(featured.getByLabelText('1 sur 2 preuves')).toBeTruthy();
    expect(screen.getAllByTestId('jobsite-card-featured')).toHaveLength(1);
    const titles = screen.getAllByRole('header').map((h) => h.props.children);
    expect(titles.indexOf('Chantier ici')).toBeLessThan(titles.indexOf('Chantier lointain'));
  });

  it('n’affiche pas les chantiers d’un autre jour', async () => {
    jobsites.data = [
      jobsite({ id: 'a', address: 'Chantier du jour' }),
      jobsite({
        id: 'b',
        address: 'Chantier de demain',
        plannedStart: '2099-01-01',
        plannedEnd: null,
      }),
    ];
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Chantier du jour')).toBeTruthy();
    expect(screen.queryByText('Chantier de demain')).toBeNull();
  });

  it('hors ligne, affiche la dernière liste connue avec sa date', async () => {
    jobsites = {
      data: [jobsite({ id: 'a', address: 'Chantier en cache' })],
      stale: true,
      fetchedAt: '2026-11-09T14:32:00',
    };
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Chantier en cache')).toBeTruthy();
    expect(screen.getByText('Hors ligne · liste de 14 h 32')).toBeTruthy();
  });

  it('sans chantier prévu, propose « Nouveau chantier »', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText("Aucun chantier prévu aujourd'hui")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nouveau chantier' })).toBeTruthy();
  });

  it('sans réseau ni cache, propose de réessayer sans bloquer', async () => {
    data.listJobsites.mockRejectedValue(new Error('offline'));
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Pas de réseau pour le moment')).toBeTruthy();
    data.listJobsites.mockImplementation(async () => jobsites);
  });

  it('mène à la fiche du chantier au tap sur « Commencer »', async () => {
    jobsites.data = [jobsite({ id: 'j1', address: 'Chantier A' })];
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Commencer' }));
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1'));
  });

  it('se déconnecte depuis « Moi » et revient à l’accueil', async () => {
    const router = await renderRouter(routes, { initialUrl: '/me' });
    expect(await screen.findByText('Jean Poseur')).toBeTruthy();
    expect(screen.getByText('Poseur · Thermi Rénov')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    await act(async () => undefined);
    await waitFor(() => expect(router.getPathname()).toBe('/welcome'));
  });
});
