import type { Annotation, WaiverReason } from '@preuvio/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { AuthProvider, type AuthService } from '@/auth/auth';
import { DataProvider } from '@/data/data-context';
import type {
  DataSource,
  NewJobsite,
  PhotoDetail,
  VoiceNote,
  PhotoSummary,
  ProofSlot,
  RecordPhotoInput,
} from '@/data/types';
import { pickFromGallery } from '@/lib/gallery';
import { processPhotoFile } from '@/lib/photo-pipeline';
import { checkPhotoQuality, type LocalCheck } from '@/lib/photo-quality';
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
jest.mock('@/lib/photo-quality', () => ({ checkPhotoQuality: jest.fn() }));
jest.mock('@/lib/heading', () => ({
  useHeadingRef: () => ({ current: 182 }),
  positionForPhoto: jest.fn(async () => ({ lat: 45.738, lng: 4.913, accuracyM: 6 })),
}));
jest.mock('@/lib/gallery', () => ({ pickFromGallery: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'photo-1' }));
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
  operationId: 'o1',
  instruction,
  phase,
  position,
  required: true,
  minPhotos: 1,
  status,
  applicable: true,
  waiverReason: null,
  waiverValidated: false,
  aiMessage: null,
  aiKept: false,
});

const okCheck: LocalCheck = {
  verdict: 'ok',
  metrics: { mean: 120, stdDev: 30, darkFraction: 0, brightFraction: 0, sharpness: 0.4 },
  ms: 60,
  kept: null,
};
let quality: LocalCheck = okCheck;
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
  listOperations: jest.fn(async (_jobsiteId: string) => []),
  answerQuestion: jest.fn(async (_o: string, _k: string, _v: boolean | number) => undefined),
  waiveSlot: jest.fn(async (_slotId: string, _reason: WaiverReason) => undefined),
  finishJobsite: jest.fn(async (_jobsiteId: string) => undefined),
  resolvePhotoCheck: jest.fn(async (_photoId: string, _keep: boolean) => undefined),
  keepDespiteAi: jest.fn(async (_slotId: string) => undefined),
  recordVoiceNote: jest.fn(
    async (_input: Parameters<DataSource['recordVoiceNote']>[0]) => undefined,
  ),
  listVoiceNotes: jest.fn(async (_jobsiteId: string): Promise<VoiceNote[]> => []),
  getPhoto: jest.fn(async (_photoId: string): Promise<PhotoDetail | null> => null),
  saveAnnotations: jest.fn(async (_photoId: string, _a: Annotation[]) => undefined),
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
  'jobsite/[id]/waive': () => null,
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
  quality = okCheck;
  jest.mocked(checkPhotoQuality).mockImplementation(async () => quality);
  // Le vrai pipeline lance le contrôle en parallèle de l'empreinte : on l'imite.
  jest.mocked(processPhotoFile).mockImplementation(async (_uri, _id, options) => ({
    localUri: 'file:///doc/photos/photo-1.jpg',
    thumbUri: 'file:///doc/photos/photo-1.thumb.jpg',
    sha256: 'b'.repeat(64),
    check: options?.check ? await options.check('file:///doc/photos/photo-1.jpg') : null,
    timings: { saveMs: 20, hashMs: 120, thumbMs: 90, checkMs: 60, totalMs: 140 },
  }));
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
      check: expect.any(Function),
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

describe('caméra et checklist (S8)', () => {
  it('« Impossible » ouvre le choix du motif pour la preuve affichée', async () => {
    const router = await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Impossible : Unité extérieure posée, vue entière',
      }),
    );
    await waitFor(() => expect(router.getPathname()).toBe('/jobsite/j1/waive'));
    expect(router.getSearchParams()).toMatchObject({ slot: 's2' });
  });

  it('une preuve dispensée laisse place à la suivante', async () => {
    slots[1] = { ...slots[1]!, status: 'waived' };
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera?slot=s2' });
    expect(await screen.findByText("Plaque de l'unité extérieure, lisible")).toBeTruthy();
  });

  it('une preuve à deux vues reste affichée après la première photo', async () => {
    slots[1] = { ...slots[1]!, minPhotos: 2 };
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    await screen.findByText('Unité extérieure posée, vue entière');
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre la photo' }));
    await waitFor(() => expect(data.recordPhoto).toHaveBeenCalled());
    expect(screen.getByText('Unité extérieure posée, vue entière')).toBeTruthy();
  });
});

describe('contrôle local (S9)', () => {
  const shoot = async () => {
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    await screen.findByText('Unité extérieure posée, vue entière');
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre la photo' }));
  };

  it('photo nette : aucune alerte, on passe à la suivante', async () => {
    await shoot();
    await waitFor(() => expect(data.recordPhoto).toHaveBeenCalled());
    expect(screen.queryByTestId('quality-alert')).toBeNull();
    expect(await screen.findByText("Plaque de l'unité extérieure, lisible")).toBeTruthy();
    expect(data.recordPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ localCheck: expect.objectContaining({ verdict: 'ok' }) }),
    );
  });

  it('photo floue : alerte immédiate, « Reprendre » reste sur la même preuve', async () => {
    quality = { ...okCheck, verdict: 'blurry' };
    await shoot();
    expect(await screen.findByText('Photo floue, reprenez')).toBeTruthy();
    await waitFor(() => expect(data.recordPhoto).toHaveBeenCalled());
    // La photo est enregistrée quand même : rien n'est perdu avant le choix.
    expect(data.recordPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ localCheck: expect.objectContaining({ verdict: 'blurry' }) }),
    );
    expect(screen.getByText('Unité extérieure posée, vue entière')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    await waitFor(() => expect(data.resolvePhotoCheck).toHaveBeenCalledWith('photo-1', false));
    expect(screen.queryByTestId('quality-alert')).toBeNull();
    expect(screen.getByText('Unité extérieure posée, vue entière')).toBeTruthy();
  });

  it('photo sombre : « Garder » la compte et passe à la suivante', async () => {
    quality = { ...okCheck, verdict: 'dark' };
    await shoot();
    expect(await screen.findByText('Trop sombre : allumez le flash')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Garder' }));
    await waitFor(() => expect(data.resolvePhotoCheck).toHaveBeenCalledWith('photo-1', true));
    expect(await screen.findByText("Plaque de l'unité extérieure, lisible")).toBeTruthy();
  });

  it('contrôle impossible : la photo est gardée sans alerte', async () => {
    jest.mocked(checkPhotoQuality).mockRejectedValue(new Error('format'));
    jest.mocked(processPhotoFile).mockImplementation(async (_uri, _id, options) => ({
      localUri: 'file:///doc/photos/photo-1.jpg',
      thumbUri: null,
      sha256: 'b'.repeat(64),
      check: options?.check ? await options.check('x').catch(() => null) : null,
      timings: { saveMs: 20, hashMs: 120, thumbMs: 90, checkMs: 0, totalMs: 140 },
    }));
    await shoot();
    await waitFor(() => expect(data.recordPhoto).toHaveBeenCalled());
    expect(screen.queryByTestId('quality-alert')).toBeNull();
  });
});

describe('note vocale depuis la caméra (S11)', () => {
  it('rattachée à la dernière photo prise', async () => {
    photos = [
      {
        id: 'last',
        proofSlotId: 's1',
        thumbUri: null,
        takenAt: '',
        outsideGeofence: false,
        source: 'camera',
      },
    ];
    await renderRouter(routes, { initialUrl: '/jobsite/j1/camera' });
    await fireEvent(
      await screen.findByRole('button', { name: 'Maintenez pour parler' }),
      'longPress',
    );
    await fireEvent(
      screen.getByRole('button', { name: 'Enregistrement… relâchez pour finir' }),
      'pressOut',
    );
    await waitFor(() =>
      expect(data.recordVoiceNote).toHaveBeenCalledWith(
        expect.objectContaining({ jobsiteId: 'j1', photoId: 'last', durationS: 7 }),
      ),
    );
  });
});
