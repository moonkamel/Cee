import type { Annotation, WaiverReason } from '@preuvio/shared';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { AuthProvider, type AuthService } from '@/auth/auth';
import { DataProvider } from '@/data/data-context';
import type {
  PhotoDetail,
  PhotoRequest,
  VoiceNote,
  AppSyncStatus,
  CachedResult,
  DataSource,
  Jobsite,
  NewJobsite,
  Profile,
  ProofSlot,
  RecordPhotoInput,
} from '@/data/types';
import { addressesNear } from '@/lib/geocoding';
import { pickContact } from '@/lib/contacts';
import { localToday } from '@/lib/position';
import { ThemeProvider } from '@/theme/theme';
import TabsLayout from '../app/(tabs)/_layout';
import Today from '../app/(tabs)/index';
import Jobsites from '../app/(tabs)/jobsites';
import Me from '../app/(tabs)/me';
import JobsiteScreen from '../app/jobsite/[id]/index';
import SummaryScreen from '../app/jobsite/[id]/summary';
import WaiveScreen from '../app/jobsite/[id]/waive';
import PhotoScreen from '../app/jobsite/[id]/photo/[photoId]';
import JobsiteNew from '../app/jobsite/new';
import LoginCode from '../app/login/code';
import LoginPhone from '../app/login/index';
import Welcome from '../app/welcome';

jest.mock('@/lib/voice', () => {
  // Faux micro : appui long → enregistrement, relâcher → note de 7 s (expo-audio est natif).
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    useVoiceRecorder: (
      onRecorded: (n: { id: string; localUri: string; durationS: number }) => void,
    ) => {
      const [recording, setRecording] = useState(false);
      return {
        recording,
        levels: [],
        denied: false,
        start: async () => setRecording(true),
        stop: async () => {
          setRecording(false);
          onRecorded({ id: 'note-1', localUri: 'file:///voice/note-1.m4a', durationS: 7 });
        },
      };
    },
  };
});
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
jest.mock('@/lib/geocoding', () => ({
  addressesNear: jest.fn(),
  searchAddresses: jest.fn(async () => []),
  nearestAddress: jest.fn(),
}));
jest.mock('@/lib/contacts', () => ({ pickContact: jest.fn() }));

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
  workTypes: ['pac_air_eau'],
  addressPending: false,
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
const IDLE: AppSyncStatus = {
  pending: 0,
  rejected: 0,
  lastSyncAt: null,
  offline: false,
  photosWaiting: 0,
  uploadBlocked: null,
};
let syncStatus: AppSyncStatus = IDLE;
const data: jest.Mocked<DataSource> = {
  listJobsites: jest.fn(async () => jobsites),
  cachedJobsites: jest.fn(async () => null),
  getProfile: jest.fn(async (_userId: string): Promise<Profile | null> => ({
    id: 'u-poseur',
    fullName: 'Jean Poseur',
    role: 'installer' as const,
    companyName: 'Thermi Rénov',
  })),
  createJobsite: jest.fn(async (_input: NewJobsite) => 'j-nouveau'),
  listSlots: jest.fn(async (_id: string) => []),
  listPhotos: jest.fn(async (_id: string) => []),
  listOperations: jest.fn(async (_jobsiteId: string) => []),
  answerQuestion: jest.fn(async (_o: string, _k: string, _v: boolean | number) => undefined),
  waiveSlot: jest.fn(async (_slotId: string, _reason: WaiverReason) => undefined),
  finishJobsite: jest.fn(async (_jobsiteId: string) => undefined),
  clientModeUrl: jest.fn(async (_jobsiteId: string): Promise<string | null> => null),
  resolvePhotoCheck: jest.fn(async (_photoId: string, _keep: boolean) => undefined),
  keepDespiteAi: jest.fn(async (_slotId: string) => undefined),
  recordVoiceNote: jest.fn(
    async (_input: Parameters<DataSource['recordVoiceNote']>[0]) => undefined,
  ),
  listVoiceNotes: jest.fn(async (_jobsiteId: string): Promise<VoiceNote[]> => []),
  getPhoto: jest.fn(async (_photoId: string): Promise<PhotoDetail | null> => null),
  saveAnnotations: jest.fn(async (_photoId: string, _a: Annotation[]) => undefined),
  listPhotoRequests: jest.fn(async (_jobsiteId?: string): Promise<PhotoRequest[]> => []),
  registerPushToken: jest.fn(async (_t: string, _p: 'ios' | 'android') => undefined),
  recordPhoto: jest.fn(async (_input: RecordPhotoInput) => undefined),
  syncStatus: jest.fn(async () => syncStatus),
  syncNow: jest.fn(async () => undefined),
  getWifiOnly: jest.fn(async () => false),
  setWifiOnly: jest.fn(async (_value: boolean) => undefined),
  onChange: jest.fn((_l: () => void) => () => undefined),
  reset: jest.fn(async () => undefined),
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
  'jobsite/new': JobsiteNew,
  'jobsite/[id]/index': JobsiteScreen,
  'jobsite/[id]/summary': SummaryScreen,
  'jobsite/[id]/waive': WaiveScreen,
  'jobsite/[id]/camera': () => null,
  'jobsite/[id]/photo/[photoId]': PhotoScreen,
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
  syncStatus = IDLE;
  data.getWifiOnly.mockResolvedValue(false);
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

  it('hors ligne, affiche la liste locale avec l’heure et les envois en attente', async () => {
    jobsites = {
      data: [jobsite({ id: 'a', address: 'Chantier en cache' })],
      stale: true,
      fetchedAt: '2026-11-09T14:32:00',
    };
    syncStatus = { ...IDLE, pending: 3, lastSyncAt: '2026-11-09T14:32:00', offline: true };
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Chantier en cache')).toBeTruthy();
    expect(
      await screen.findByText('Hors ligne · liste de 14 h 32 · 3 en attente d’envoi'),
    ).toBeTruthy();
  });

  it('signale les photos en attente et la pause pour batterie faible', async () => {
    jobsites.data = [jobsite({ id: 'a', address: 'Chantier' })];
    syncStatus = { ...IDLE, photosWaiting: 2, uploadBlocked: 'battery' };
    await renderRouter(routes, { initialUrl: '/' });
    expect(
      await screen.findByText(
        '2 photos en attente d’envoi · Batterie faible : branchez pour envoyer',
      ),
    ).toBeTruthy();
  });

  it('n’affiche aucun indicateur quand tout est à jour', async () => {
    jobsites.data = [jobsite({ id: 'a', address: 'Chantier' })];
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Chantier')).toBeTruthy();
    expect(screen.queryByTestId('sync-indicator')).toBeNull();
  });

  it('sans chantier prévu, « Nouveau chantier » ouvre la création rapide', async () => {
    const router = await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText("Aucun chantier prévu aujourd'hui")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Nouveau chantier' }));
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/new'));
  });

  it('si la base locale est illisible, propose de réessayer sans bloquer', async () => {
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
    // Les données locales de l'entreprise sont effacées avant la déconnexion.
    expect(data.reset).toHaveBeenCalled();
    expect(data.reset.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signOut.mock.invocationCallOrder[0]!,
    );
  });

  it('avec des photos pas encore envoyées, la déconnexion demande un second tap', async () => {
    syncStatus = { ...IDLE, photosWaiting: 2 };
    const router = await renderRouter(routes, { initialUrl: '/me' });
    expect(await screen.findByText('Jean Poseur')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(
      await screen.findByText('2 photo(s) non envoyée(s) : perdues si déconnexion'),
    ).toBeTruthy();
    expect(data.reset).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter quand même' }));
    await waitFor(() => expect(router.getPathname()).toBe('/welcome'));
    expect(data.reset).toHaveBeenCalled();
  });

  it('« Wi-Fi uniquement » est désactivé par défaut et se règle d’un tap', async () => {
    await renderRouter(routes, { initialUrl: '/me' });
    const toggle = await screen.findByRole('switch', { name: 'Photos en Wi-Fi uniquement' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(toggle);
    expect(data.setWifiOnly).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole('switch', { name: 'Photos en Wi-Fi uniquement' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
  });
});

describe('création rapide d’un chantier (S5)', () => {
  beforeEach(() => {
    signedInUser = 'u-poseur';
  });

  it('crée un chantier en 3 étapes : adresse GPS, travaux, client des contacts', async () => {
    withPosition(HERE);
    jest.mocked(addressesNear).mockResolvedValue([
      {
        label: '8 Allée des Tilleuls 69500 Bron',
        banId: '69029_x',
        lat: HERE.lat,
        lng: HERE.lng,
      },
    ]);
    jest.mocked(pickContact).mockResolvedValue({ fullName: 'M. Martin', phone: '06 39 98 01 01' });
    const router = await renderRouter(routes, { initialUrl: '/jobsite/new' });

    expect(await screen.findByText('Étape 1 sur 3')).toBeTruthy();
    await fireEvent.press(
      await screen.findByRole('button', {
        name: '8 Allée des Tilleuls 69500 Bron. La plus proche',
      }),
    );

    expect(await screen.findByText('Étape 2 sur 3')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Continuer' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'PAC air/eau' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'VMC' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Étape 3 sur 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir dans mes contacts' }));
    expect(await screen.findByText('M. Martin')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Créer le chantier' }));

    expect(data.createJobsite).toHaveBeenCalledWith({
      address: {
        label: '8 Allée des Tilleuls 69500 Bron',
        banId: '69029_x',
        lat: HERE.lat,
        lng: HERE.lng,
        pending: false,
      },
      workTypes: ['pac_air_eau', 'vmc'],
      client: { fullName: 'M. Martin', phone: '06 39 98 01 01' },
    });
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j-nouveau'));
  });

  it('hors ligne, garde la position GPS et crée le chantier sans client', async () => {
    withPosition(HERE);
    jest.mocked(addressesNear).mockRejectedValue(new Error('réseau'));
    await renderRouter(routes, { initialUrl: '/jobsite/new' });

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Garder ma position. Adresse complétée au retour du réseau',
      }),
    );
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Isolation des combles' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Créer le chantier' }));

    expect(data.createJobsite).toHaveBeenCalledWith({
      address: expect.objectContaining({
        pending: true,
        lat: HERE.lat,
        lng: HERE.lng,
        banId: null,
      }),
      workTypes: ['combles'],
      client: null,
    });
  });
});

// --- S8 : questions rapides, dispense, fin de chantier -------------------------------------
const proof = (id: string, over: Partial<ProofSlot> = {}): ProofSlot => ({
  id,
  jobsiteId: 'j1',
  operationId: 'o1',
  instruction: `Preuve ${id}`,
  phase: 'apres',
  position: 0,
  required: true,
  minPhotos: 1,
  status: 'missing',
  applicable: true,
  waiverReason: null,
  waiverValidated: false,
  aiMessage: null,
  aiKept: false,
  ...over,
});

describe('checklist d’un chantier (S8)', () => {
  beforeEach(() => {
    signedInUser = 'u-poseur';
    jobsites.data = [jobsite({ id: 'j1', address: 'Chantier A' })];
    data.listOperations.mockResolvedValue([
      {
        id: 'o1',
        label: 'Pompe à chaleur air/eau',
        draft: true,
        questions: [
          {
            key: 'old_boiler_removed',
            label: 'Ancienne chaudière déposée ?',
            type: 'yes_no',
            value: null,
          },
          {
            key: 'indoor_units',
            label: 'Nombre d’unités intérieures',
            type: 'number',
            min: 1,
            max: 4,
            value: 1,
          },
        ],
      },
    ]);
  });
  afterEach(() => {
    data.listSlots.mockResolvedValue([]);
    data.listOperations.mockResolvedValue([]);
  });

  it('répond aux questions rapides d’un tap, la checklist suit', async () => {
    data.listSlots.mockResolvedValue([proof('a')]);
    await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Ancienne chaudière déposée ? Non' }),
    );
    expect(data.answerQuestion).toHaveBeenCalledWith('o1', 'old_boiler_removed', false);
    await fireEvent.press(screen.getByRole('button', { name: '+' }));
    expect(data.answerQuestion).toHaveBeenCalledWith('o1', 'indoor_units', 2);
    // Au minimum, « − » est désactivé.
    expect(screen.getByRole('button', { name: '−' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByText('Checklist en brouillon, à faire relire')).toBeTruthy();
  });

  it('« Fin de chantier » ouvre le récapitulatif', async () => {
    data.listSlots.mockResolvedValue([proof('a')]);
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Fin de chantier' }));
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1/summary'));
  });

  it('tout est pris : « 2 preuves sur 2 », terminer d’un tap', async () => {
    data.listSlots.mockResolvedValue([
      proof('a', { status: 'captured' }),
      proof('b', { status: 'waived', waiverReason: 'inaccessible' }),
    ]);
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1/summary' });
    expect(await screen.findByText('2 preuves sur 2')).toBeTruthy();
    expect(screen.getByText('1 dispense(s) à valider par le bureau')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Terminer le chantier' }));
    expect(data.finishJobsite).toHaveBeenCalledWith('j1');
    await waitFor(() => expect(router.getPathname()).toBe('/'));
  });

  it('avec des manques : liste avec caméra, puis « Terminer quand même » au second tap', async () => {
    data.listSlots.mockResolvedValue([proof('a', { status: 'captured' }), proof('b')]);
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1/summary' });
    expect(await screen.findByText('1 preuves sur 2')).toBeTruthy();
    expect(screen.getByText('Il manque 1 preuve(s)')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Terminer le chantier' }));
    expect(data.finishJobsite).not.toHaveBeenCalled();
    expect(screen.getByText('Preuves manquantes : le bureau sera prévenu')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Terminer quand même' }));
    expect(data.finishJobsite).toHaveBeenCalledWith('j1');
    await waitFor(() => expect(router.getPathname()).toBe('/'));
  });

  it('mode client : la page client s’ouvre ; hors ligne, un message', async () => {
    data.listSlots.mockResolvedValue([proof('a', { status: 'captured' })]);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    data.clientModeUrl.mockResolvedValueOnce('https://preuvio-web.vercel.app/c/jeton');
    await renderRouter(routes, { initialUrl: '/jobsite/j1/summary' });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Faire signer le PV au client' }),
    );
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://preuvio-web.vercel.app/c/jeton'),
    );
    expect(data.clientModeUrl).toHaveBeenCalledWith('j1');

    data.clientModeUrl.mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Faire signer le PV au client' }));
    expect(await screen.findByText('Réseau nécessaire pour la signature')).toBeTruthy();
    open.mockRestore();
  });

  it('un manque ouvre la caméra sur la bonne preuve', async () => {
    data.listSlots.mockResolvedValue([proof('b')]);
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1/summary' });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Photographier : Preuve b. Manquante' }),
    );
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1/camera'));
    expect(router.getSearchParams()).toMatchObject({ slot: 'b' });
  });

  it('« Impossible » : un motif en un tap, puis retour', async () => {
    data.listSlots.mockResolvedValue([proof('b')]);
    await renderRouter(routes, { initialUrl: '/jobsite/j1/waive?slot=b' });
    expect(await screen.findByText('Preuve b')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Équipement inaccessible' }));
    expect(data.waiveSlot).toHaveBeenCalledWith('b', 'inaccessible');
  });
});

// --- S10 : pastilles du pré-contrôle IA ------------------------------------------------------
describe('pré-contrôle IA (S10)', () => {
  beforeEach(() => {
    signedInUser = 'u-poseur';
    jobsites.data = [jobsite({ id: 'j1', address: 'Chantier A' })];
  });
  afterEach(() => data.listSlots.mockResolvedValue([]));

  it('alerte orange : le message de l’IA, puis « Reprendre » ouvre la caméra', async () => {
    data.listSlots.mockResolvedValue([
      proof('p', {
        instruction: "Plaque de l'unité extérieure",
        status: 'to_retake',
        aiMessage: 'Plaque illisible, rapprochez-vous',
      }),
      proof('u', { instruction: 'Unité extérieure posée', status: 'compliant' }),
    ]);
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    expect(await screen.findByText('Plaque illisible, rapprochez-vous')).toBeTruthy();
    // Pastilles : orange « À reprendre », vert « Validée ».
    expect(
      screen.getByLabelText("Photographier : Plaque de l'unité extérieure. À reprendre"),
    ).toBeTruthy();
    expect(screen.getByLabelText('Photographier : Unité extérieure posée. Validée')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1/camera'));
    expect(router.getSearchParams()).toMatchObject({ slot: 'p' });
  });

  it('« Garder quand même » : le bureau tranchera', async () => {
    data.listSlots.mockResolvedValue([
      proof('p', { status: 'to_retake', aiMessage: 'Plaque illisible, rapprochez-vous' }),
    ]);
    await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Garder quand même' }));
    expect(data.keepDespiteAi).toHaveBeenCalledWith('p');
  });

  it('photo gardée : plus d’alerte, et elle ne compte pas comme manque', async () => {
    data.listSlots.mockResolvedValue([
      proof('p', {
        status: 'to_retake',
        aiMessage: 'Plaque illisible, rapprochez-vous',
        aiKept: true,
      }),
    ]);
    await renderRouter(routes, { initialUrl: '/jobsite/j1/summary' });
    expect(await screen.findByText('1 preuves sur 1')).toBeTruthy();
    expect(screen.getByText('1 photo(s) gardée(s), à trancher par le bureau')).toBeTruthy();
    expect(screen.queryByTestId('ai-alert')).toBeNull();
  });
});

// --- S11 : notes vocales et annotations ----------------------------------------------------
describe('notes vocales et annotations (S11)', () => {
  beforeEach(() => {
    signedInUser = 'u-poseur';
    jobsites.data = [jobsite({ id: 'j1', address: 'Chantier A' })];
  });
  afterEach(() => {
    data.listVoiceNotes.mockResolvedValue([]);
    data.listPhotos.mockResolvedValue([]);
    data.getPhoto.mockResolvedValue(null);
  });

  it('appui long sur le micro : la note est rangée sur le téléphone', async () => {
    await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    const mic = await screen.findByRole('button', { name: 'Maintenez pour parler' });
    await fireEvent(mic, 'longPress');
    await fireEvent(
      screen.getByRole('button', { name: 'Enregistrement… relâchez pour finir' }),
      'pressOut',
    );
    await waitFor(() =>
      expect(data.recordVoiceNote).toHaveBeenCalledWith({
        id: 'note-1',
        localUri: 'file:///voice/note-1.m4a',
        durationS: 7,
        jobsiteId: 'j1',
        photoId: null,
      }),
    );
    expect(await screen.findByText('Note enregistrée')).toBeTruthy();
  });

  it('liste les notes : en attente hors ligne, puis transcrites avec ce qui a été repéré', async () => {
    data.listVoiceNotes.mockResolvedValue([
      {
        id: 'a',
        jobsiteId: 'j1',
        photoId: null,
        durationS: 7,
        createdAt: '',
        status: 'pending',
        text: null,
        items: [],
      },
      {
        id: 'b',
        jobsiteId: 'j1',
        photoId: null,
        durationS: 12,
        createdAt: '',
        status: 'done',
        text: 'Il manque un raccord, commander 2 coudes.',
        items: [
          { kind: 'problem', summary: 'Raccord manquant', quantity: null, unit: null },
          { kind: 'material', summary: 'coudes', quantity: 2, unit: null },
        ],
      },
    ]);
    await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    expect(await screen.findByText('Transcription en attente')).toBeTruthy();
    expect(screen.getByText('Il manque un raccord, commander 2 coudes.')).toBeTruthy();
    expect(screen.getByText('Signalé au bureau : Raccord manquant')).toBeTruthy();
    expect(screen.getByText('À commander : 2 coudes')).toBeTruthy();
  });

  it('dessine un rectangle et un texte sur le calque, puis enregistre', async () => {
    data.getPhoto.mockResolvedValue({
      id: 'p1',
      proofSlotId: null,
      thumbUri: 'file:///t.jpg',
      takenAt: '2026-11-09T09:00:00Z',
      outsideGeofence: false,
      source: 'camera',
      uri: 'file:///p1.jpg',
      annotations: [],
    });
    await renderRouter(routes, { initialUrl: '/jobsite/j1/photo/p1' });
    const canvas = await screen.findByTestId('photo-canvas');
    await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 400, height: 300 } } });
    const touch = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } });

    await fireEvent.press(screen.getByRole('button', { name: 'Rectangle' }));
    await fireEvent(canvas, 'responderGrant', touch(40, 30));
    await fireEvent(canvas, 'responderMove', touch(200, 150));
    await fireEvent(canvas, 'responderRelease', touch(200, 150));

    await fireEvent.press(screen.getByRole('button', { name: 'Texte' }));
    await fireEvent(canvas, 'responderGrant', touch(100, 60));
    await fireEvent(canvas, 'responderRelease', touch(100, 60));
    await fireEvent.changeText(screen.getByLabelText('Texte à afficher'), 'Fuite ici');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter le texte' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(data.saveAnnotations).toHaveBeenCalledWith('p1', [
      { type: 'rect', from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.5 } },
      { type: 'text', at: { x: 0.25, y: 0.2 }, text: 'Fuite ici' },
    ]);
  });

  it('une note dictée depuis la photo lui est rattachée', async () => {
    data.getPhoto.mockResolvedValue({
      id: 'p1',
      proofSlotId: null,
      thumbUri: null,
      takenAt: '',
      outsideGeofence: false,
      source: 'camera',
      uri: null,
      annotations: [],
    });
    await renderRouter(routes, { initialUrl: '/jobsite/j1/photo/p1' });
    await fireEvent(
      await screen.findByRole('button', { name: 'Maintenez pour parler' }),
      'longPress',
    );
    await fireEvent(
      screen.getByRole('button', { name: 'Enregistrement… relâchez pour finir' }),
      'pressOut',
    );
    await waitFor(() =>
      expect(data.recordVoiceNote).toHaveBeenCalledWith(expect.objectContaining({ photoId: 'p1' })),
    );
  });
});

// --- S12 : le poseur reçoit la demande de reprise -----------------------------------------
describe('demande de reprise du bureau (S12)', () => {
  const request: PhotoRequest = {
    id: 'r1',
    jobsiteId: 'j1',
    jobsiteAddress: '8 allée des Tilleuls, Bron',
    proofSlotId: 's7',
    instruction: "Plaque de l'unité extérieure",
    message: 'Plaque illisible, rapprochez-vous',
    requestedAt: '2026-11-09T10:00:00Z',
  };
  beforeEach(() => {
    signedInUser = 'u-poseur';
    jobsites.data = [jobsite({ id: 'j1', address: '8 allée des Tilleuls, Bron' })];
  });
  afterEach(() => data.listPhotoRequests.mockResolvedValue([]));

  it('« Aujourd’hui » affiche la demande ; un tap ouvre la caméra sur la bonne preuve', async () => {
    data.listPhotoRequests.mockResolvedValue([request]);
    const router = await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Photo à reprendre')).toBeTruthy();
    expect(screen.getByText('« Plaque illisible, rapprochez-vous »')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre la photo' }));
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1/camera'));
    expect(router.getSearchParams()).toMatchObject({ slot: 's7' });
  });

  it('la fiche du chantier affiche ses demandes', async () => {
    data.listPhotoRequests.mockResolvedValue([request]);
    await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    expect(await screen.findByText("Plaque de l'unité extérieure")).toBeTruthy();
    expect(data.listPhotoRequests).toHaveBeenCalledWith('j1');
  });
});

// --- Accessibilité (sections 1 et 17) -----------------------------------------------------------
describe('accessibilité des écrans du poseur', () => {
  const flat = (style: unknown): Record<string, unknown> =>
    Array.isArray(style)
      ? Object.assign({}, ...style.map(flat))
      : style && typeof style === 'object'
        ? (style as Record<string, unknown>)
        : {};
  const textOf = (node: { children?: unknown[]; props?: { children?: unknown } }): string =>
    (node.children ?? []).map((c) => (typeof c === 'string' ? c : textOf(c as never))).join('');

  it.each(['/', '/me', '/jobsites'])(
    '%s : chaque bouton a un nom et une taille de toucher suffisante',
    async (url) => {
      signedInUser = 'u-poseur';
      jobsites.data = [jobsite({ id: 'j1', address: '8 allée des Tilleuls, Bron' })];
      await renderRouter(routes, { initialUrl: url });
      await waitFor(() => expect(screen.queryAllByRole('button').length).toBeGreaterThan(0));
      for (const button of screen.queryAllByRole('button')) {
        const name = button.props.accessibilityLabel ?? textOf(button as never);
        expect(String(name).trim()).not.toBe('');
        const style = flat(button.props.style);
        const size = Math.max(Number(style.minHeight ?? 0), Number(style.height ?? 0));
        // Les onglets du bas sont dimensionnés par la barre de navigation elle-même.
        if (size > 0) expect(size).toBeGreaterThanOrEqual(48);
      }
    },
  );
});
