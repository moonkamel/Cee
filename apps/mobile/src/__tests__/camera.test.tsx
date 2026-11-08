import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { AuthProvider, type AuthService } from '@/auth/auth';
import { DataProvider } from '@/data/data-context';
import type {
  DataSource,
  NewJobsite,
  PhotoSummary,
  ProofSlot,
  RecordPhotoInput,
} from '@/data/types';
import { pickFromGallery } from '@/lib/gallery';
import { processPhotoFile } from '@/lib/photo-pipeline';
import { ThemeProvider } from '@/theme/theme';
import CameraScreen from '../app/jobsite/[id]/camera';
import JobsiteScreen from '../app/jobsite/[id]/index';

const mockCapture = jest.fn();
jest.mock('react-native-vision-camera', () => {
  const { forwardRef } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    Camera: forwardRef((_props: object, _ref: unknown) => <View testID="camera-preview" />),
    CommonResolutions: { UHD_4_3: { width: 3000, height: 4000 } },
    useCameraDevice: () => ({ id: 'back' }),
    useCameraPermission: () => ({
      hasPermission: true,
      status: 'granted',
      requestPermission: jest.fn(),
    }),
    usePhotoOutput: () => ({ capturePhotoToFile: mockCapture }),
  };
});
jest.mock('@/lib/photo-pipeline', () => ({ processPhotoFile: jest.fn() }));
jest.mock('@/lib/heading', () => ({
  useHeadingRef: () => ({ current: 182 }),
  positionForPhoto: jest.fn(async () => ({ lat: 45.738, lng: 4.913, accuracyM: 6 })),
}));
jest.mock('@/lib/gallery', () => ({ pickFromGallery: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'photo-1' }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const slot = (
  id: string,
  instruction: string,
  phase: ProofSlot['phase'],
  position: number,
  status: ProofSlot['status'] = 'missing',
): ProofSlot => ({
  id,
  jobsiteId: 'j1',
  instruction,
  phase,
  position,
  required: true,
  status,
});

let slots: ProofSlot[] = [];
let photos: PhotoSummary[] = [];
const data: jest.Mocked<DataSource> = {
  listJobsites: jest.fn(async () => ({
    data: [],
    stale: false,
    fetchedAt: '2026-11-09T09:00:00Z',
  })),
  cachedJobsites: jest.fn(async () => null),
  getProfile: jest.fn(async (_userId: string) => null),
  createJobsite: jest.fn(async (_input: NewJobsite) => 'x'),
  listSlots: jest.fn(async (_jobsiteId: string) => slots),
  listPhotos: jest.fn(async (_jobsiteId: string) => photos),
  recordPhoto: jest.fn(async (_input: RecordPhotoInput) => undefined),
  syncStatus: jest.fn(async () => ({
    pending: 0,
    rejected: 0,
    lastSyncAt: null,
    offline: false,
    photosWaiting: 0,
    uploadBlocked: null,
  })),
  syncNow: jest.fn(async () => undefined),
  getWifiOnly: jest.fn(async () => false),
  setWifiOnly: jest.fn(async (_value: boolean) => undefined),
  onChange: jest.fn((_listener: () => void) => () => undefined),
  reset: jest.fn(async () => undefined),
};
const auth: AuthService = {
  currentUserId: async () => 'u-poseur',
  onChange: () => () => undefined,
  sendCode: async () => undefined,
  verifyCode: async () => undefined,
  signOut: async () => undefined,
};

function Layout() {
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
  _layout: Layout,
  'jobsite/[id]/index': JobsiteScreen,
  'jobsite/[id]/camera': CameraScreen,
};

beforeEach(() => {
  jest.clearAllMocks();
  slots = [
    slot('s1', 'Chaudière existante avant dépose', 'avant', 1, 'captured'),
    slot('s2', 'Unité extérieure posée, vue entière', 'apres', 1),
    slot('s3', "Plaque de l'unité extérieure, lisible", 'apres', 2),
  ];
  photos = [];
  mockCapture.mockResolvedValue({ filePath: '/tmp/vc-1.jpg', width: 4000, height: 3000 });
  jest.mocked(processPhotoFile).mockResolvedValue({
    localUri: 'file:///doc/photos/photo-1.jpg',
    thumbUri: 'file:///doc/photos/photo-1.thumb.jpg',
    sha256: 'b'.repeat(64),
    timings: { saveMs: 20, hashMs: 120, thumbMs: 90, totalMs: 140 },
  });
});

describe('caméra guidée (S6)', () => {
  it('s’ouvre sur la prochaine preuve à prendre, avec son rang', async () => {
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    expect(await screen.findByText('Unité extérieure posée, vue entière')).toBeTruthy();
    expect(screen.getByText('Photo 2 sur 3')).toBeTruthy();
    expect(screen.getByLabelText('1 sur 3 preuves')).toBeTruthy();
  });

  it('enregistre la photo avec toutes ses métadonnées, puis passe à la preuve suivante', async () => {
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    await screen.findByText('Unité extérieure posée, vue entière');
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre la photo' }));

    await waitFor(() => expect(data.recordPhoto).toHaveBeenCalled());
    expect(mockCapture).toHaveBeenCalledWith({ flashMode: 'auto' }, {});
    expect(processPhotoFile).toHaveBeenCalledWith('/tmp/vc-1.jpg', 'photo-1', {
      size: { width: 4000, height: 3000 },
    });
    expect(data.recordPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'photo-1',
        jobsiteId: 'j1',
        proofSlotId: 's2',
        position: { lat: 45.738, lng: 4.913, accuracyM: 6 },
        headingDeg: 182,
        sha256: 'b'.repeat(64),
        source: 'camera',
        width: 4000,
        height: 3000,
        localUri: 'file:///doc/photos/photo-1.jpg',
      }),
    );
    expect(Date.parse(data.recordPhoto.mock.calls[0]![0].takenAt)).not.toBeNaN();
    // Rafale : pas d'écran de validation, la consigne suivante s'affiche.
    expect(await screen.findByText("Plaque de l'unité extérieure, lisible")).toBeTruthy();
  });

  it('ouvre directement la preuve demandée depuis la checklist', async () => {
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera?slot=s3' });
    expect(await screen.findByText("Plaque de l'unité extérieure, lisible")).toBeTruthy();
    expect(screen.getByText('Photo 3 sur 3')).toBeTruthy();
  });

  it('quand tout est pris, la photo devient une photo libre', async () => {
    slots = slots.map((s) => ({ ...s, status: 'captured' as const }));
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    expect(await screen.findByText('Toutes les preuves sont prises')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre la photo' }));
    await waitFor(() =>
      expect(data.recordPhoto).toHaveBeenCalledWith(expect.objectContaining({ proofSlotId: null })),
    );
  });

  it('signale un échec de prise de vue sans bloquer la caméra', async () => {
    mockCapture.mockRejectedValueOnce(new Error('caméra occupée'));
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    await screen.findByText('Unité extérieure posée, vue entière');
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre la photo' }));
    expect(await screen.findByText('Photo non enregistrée. Reprenez.')).toBeTruthy();
    expect(data.recordPhoto).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Prendre la photo' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  it('affiche la dernière photo et le badge hors chantier', async () => {
    photos = [
      {
        id: 'p0',
        proofSlotId: 's1',
        thumbUri: 'file:///t.jpg',
        takenAt: '2026-11-09T09:00:00Z',
        outsideGeofence: true,
        source: 'camera',
      },
    ];
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    expect(await screen.findByTestId('last-thumbnail')).toBeTruthy();
    expect(screen.getByText('Hors chantier')).toBeTruthy();
  });
});

describe('fiche chantier (S6)', () => {
  it('liste les preuves ; un tap ouvre la caméra sur la bonne consigne', async () => {
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    await fireEvent.press(
      await screen.findByRole('button', {
        name: "Photographier : Plaque de l'unité extérieure, lisible. Manquante",
      }),
    );
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1/camera'));
    expect(router.getSearchParams()).toMatchObject({ slot: 's3' });
  });

  it('« Commencer » ouvre la caméra sur la prochaine preuve', async () => {
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Commencer' }));
    await waitFor(() => expect(router.getSearchParams()).toMatchObject({ slot: 's2' }));
  });

  it('une image de la galerie est enregistrée comme photo libre importée, jamais comme preuve', async () => {
    jest
      .mocked(pickFromGallery)
      .mockResolvedValue({ uri: 'file:///gallery/x.jpg', width: 1200, height: 900 });
    await renderRouter(routes, { initialUrl: '/jobsite/j1' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Ajouter depuis la galerie' }));
    await waitFor(() =>
      expect(data.recordPhoto).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'gallery_import', proofSlotId: null, position: null }),
      ),
    );
    expect(processPhotoFile).toHaveBeenCalledWith(
      'file:///gallery/x.jpg',
      'photo-1',
      expect.objectContaining({ copy: true }),
    );
  });
});
