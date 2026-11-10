import { nextSlot, proofProgress, slotRank } from '@preuvio/shared';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import {
  AppText,
  BigButton,
  EmptyState,
  Icon,
  ProgressRing,
  ShutterButton,
  Toast,
  type IconName,
} from '@/components/ui';
import { useData } from '@/data/data-context';
import { useProofs } from '@/data/use-proofs';
import { t } from '@/i18n/fr';
import { positionForPhoto, useHeadingRef } from '@/lib/heading';
import { haptics } from '@/lib/haptics';
import {
  cameraMounting,
  cameraReady,
  recordPerf,
  recordPerfSince,
  track,
  trackOnce,
} from '@/lib/telemetry';
import { processPhotoFile } from '@/lib/photo-pipeline';
import { checkPhotoQuality } from '@/lib/photo-quality';
import { useVoiceRecorder } from '@/lib/voice';
import type { QualityIssue } from '@preuvio/shared';
import { useTheme } from '@/theme/theme';
import { cameraColors as cam } from '@preuvio/ui-tokens';

// Caméra guidée (section 6) : la consigne en haut, le déclencheur en bas, en rafale,
// sans écran de validation. Chaque photo est horodatée, géolocalisée, orientée et scellée
// (SHA-256) puis mise en file d'envoi, réseau ou pas.

export default function CameraScreen() {
  const { id, slot: slotParam } = useLocalSearchParams<{ id: string; slot?: string }>();
  const data = useData();
  const { colors, spacing, radius, sizes, toggleContrast, scheme } = useTheme();
  const { slots, photos } = useProofs(id);
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.UHD_4_3, quality: 0.9 });
  const cameraRef = useRef<CameraRef>(null);
  const heading = useHeadingRef();
  // undefined : pas encore choisie → la preuve demandée, sinon la prochaine à prendre.
  const [chosenId, setCurrentId] = useState<string | null | undefined>(slotParam);
  const [flashAuto, setFlashAuto] = useState(true);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(false);
  const recorded = useRef(new Map<string, Promise<void>>());
  // Note dictée depuis la caméra : rattachée à la dernière photo prise, s'il y en a une.
  const voice = useVoiceRecorder((note) => {
    void data.recordVoiceNote({ ...note, jobsiteId: id, photoId: photos[0]?.id ?? null });
  }, randomUUID);
  // Alerte du contrôle local (S9) : la photo est enregistrée, le poseur choisit.
  const [alert, setAlert] = useState<{
    photoId: string;
    slotId: string | null;
    issue: QualityIssue;
  } | null>(null);

  useEffect(() => {
    if (!permission.hasPermission) void permission.requestPermission();
  }, [permission]);
  useEffect(() => trackOnce(`jobsite:${id}`, 'jobsite_started'), [id]);
  useEffect(() => cameraMounting(), []);

  // Sans preuve demandée : la prochaine à prendre, ou photo libre si tout est pris.
  // Revenue de « Impossible » : la preuve dispensée laisse place à la suivante.
  const chosenWaived = !!chosenId && slots?.find((s) => s.id === chosenId)?.status === 'waived';
  const currentId =
    chosenId !== undefined && !chosenWaived
      ? chosenId
      : slots
        ? (nextSlot(slots, chosenWaived ? chosenId : null)?.id ?? null)
        : null;

  const current = slots?.find((s) => s.id === currentId) ?? null;
  const { done, total } = proofProgress(slots ?? []);
  const rank = current && slots ? slotRank(slots, current.id) : null;
  const allDone = !!slots && slots.length > 0 && nextSlot(slots) === null;

  const last = photos[0];

  async function capture() {
    if (capturing) return;
    setCapturing(true);
    const shutter = new Date();
    const takenAt = shutter.toISOString();
    const position = positionForPhoto(); // en parallèle de la prise de vue
    const photoId = randomUUID();
    const slotId = current?.id ?? null;
    let resolveRecorded = () => {};
    recorded.current.set(photoId, new Promise<void>((r) => (resolveRecorded = r)));
    try {
      const file = await photoOutput.capturePhotoToFile(
        { flashMode: flashAuto ? 'auto' : 'off' },
        {},
      );
      // La rafale reprend dès que le fichier existe ; le traitement continue en arrière-plan.
      setCapturing(false);
      const processed = await processPhotoFile(file.filePath, photoId, {
        size: { width: file.width, height: file.height },
        // L'alerte s'affiche dès le verdict, sans attendre l'empreinte ni la vignette.
        check: async (uri) => {
          const result = await checkPhotoQuality(uri);
          recordPerf('local_check', result.ms);
          console.info('[photo] contrôle local', {
            verdict: result.verdict,
            checkMs: result.ms,
            sinceShutterMs: new Date().getTime() - shutter.getTime(),
          });
          if (result.verdict !== 'ok') {
            void haptics.error();
            setAlert({ photoId, slotId, issue: result.verdict });
          }
          return result;
        },
      });
      await data.recordPhoto({
        id: photoId,
        jobsiteId: id,
        proofSlotId: slotId,
        takenAt,
        position: await position,
        headingDeg: heading.current,
        sha256: processed.sha256,
        source: 'camera',
        width: file.width,
        height: file.height,
        localUri: processed.localUri,
        thumbUri: processed.thumbUri,
        localCheck: processed.check,
      });
      console.info('[photo] enregistrée', { ...processed.timings });
      recordPerfSince('shutter_to_saved', shutter.getTime());
      track('photo_taken', {
        proof: slotId !== null,
        local_check: processed.check?.verdict ?? 'ok',
      });
      // Photo douteuse : on reste sur la preuve tant que le poseur n'a pas choisi.
      if ((processed.check?.verdict ?? 'ok') === 'ok') advanceAfter(slotId);
    } catch {
      setCapturing(false);
      void haptics.error();
      setError(true);
    } finally {
      resolveRecorded();
    }
  }

  function advanceAfter(slotId: string | null) {
    if (!slotId || !slots) return;
    // Preuve à plusieurs vues : on reste dessus jusqu'au nombre minimal de photos.
    const taken = photos.filter((p) => p.proofSlotId === slotId).length + 1;
    const slot = slots.find((s) => s.id === slotId);
    if (slot && taken >= slot.minPhotos) {
      const after = slots.map((s) => (s.id === slotId ? { ...s, status: 'captured' as const } : s));
      setCurrentId(nextSlot(after, slotId)?.id ?? null);
      void haptics.proofValidated();
    }
  }

  function resolveAlert(keep: boolean) {
    if (!alert) return;
    const { photoId, slotId } = alert;
    // Le choix peut précéder la fin de l'enregistrement : il est appliqué juste après.
    void (recorded.current.get(photoId) ?? Promise.resolve()).then(() =>
      data.resolvePhotoCheck(photoId, keep),
    );
    if (keep) advanceAfter(slotId);
    else setCurrentId(slotId);
    setAlert(null);
  }

  async function setZoomLevel(level: 1 | 2) {
    setZoom(level);
    const controller = cameraRef.current?.controller;
    if (controller) {
      const target = Math.min(controller.maxZoom, Math.max(controller.minZoom, level));
      await controller.setZoom(target).catch(() => undefined);
    }
  }

  if (!permission.hasPermission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <EmptyState
          icon="camera-off-outline"
          title={t('camera.permission')}
          actionLabel={t('camera.permissionAction')}
          onAction={() => {
            void permission
              .requestPermission()
              .then((ok) => (ok ? undefined : Linking.openSettings()));
          }}
        />
      </SafeAreaView>
    );
  }

  const roundButton = (icon: IconName, label: string, onPress: () => void, active = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        width: sizes.touchMin,
        height: sizes.touchMin,
        borderRadius: sizes.touchMin / 2,
        borderWidth: 2,
        borderColor: cam.ink,
        backgroundColor: active ? colors.action : cam.scrim,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        name={icon}
        color="on-action"
        fixedColor={active ? undefined : cam.ink}
        size={sizes.icon}
      />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: cam.background }}>
      <SafeAreaView
        edges={['top']}
        style={{
          backgroundColor: colors.surface,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}
      >
        <View
          testID="camera-instruction"
          accessible
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" color="text-muted">
              {current && rank
                ? t('camera.photoOf', rank)
                : allDone
                  ? t('camera.allDone')
                  : t('camera.free')}
            </AppText>
            <AppText variant="button">
              {current ? current.instruction : t('camera.freeHint')}
            </AppText>
          </View>
          {current ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('waive.action')} : ${current.instruction}`}
              onPress={() =>
                router.push({ pathname: '/jobsite/[id]/waive', params: { id, slot: current.id } })
              }
              style={{
                minHeight: sizes.touchMin,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="button" color="brand">
                {t('waive.action')}
              </AppText>
            </Pressable>
          ) : null}
          {total > 0 ? <ProgressRing done={done} total={total} size={64} /> : null}
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {device ? (
          <Camera
            ref={cameraRef}
            style={{ flex: 1 }}
            device={device}
            outputs={[photoOutput]}
            isActive
            onStarted={cameraReady}
            enableNativeZoomGesture
            enableNativeTapToFocusGesture
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <AppText style={{ color: cam.ink }}>{t('camera.noDevice')}</AppText>
          </View>
        )}
        <View style={{ position: 'absolute', top: spacing.lg, right: spacing.lg, gap: spacing.sm }}>
          {roundButton(
            'white-balance-sunny',
            t('camera.contrast'),
            toggleContrast,
            scheme === 'contrast',
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.recording ? t('voice.recording') : t('voice.hold')}
            accessibilityState={{ busy: voice.recording }}
            delayLongPress={250}
            onLongPress={() => {
              void haptics.recordEdge();
              void voice.start();
            }}
            onPressOut={() => {
              if (!voice.recording) return;
              void haptics.recordEdge();
              void voice.stop();
            }}
            style={{
              width: sizes.touchMin,
              height: sizes.touchMin,
              borderRadius: sizes.touchMin / 2,
              borderWidth: 2,
              borderColor: cam.ink,
              backgroundColor: voice.recording ? colors.action : cam.scrim,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="microphone"
              color="on-action"
              fixedColor={voice.recording ? undefined : cam.ink}
            />
          </Pressable>
          {roundButton(
            flashAuto ? 'flash-auto' : 'flash-off',
            flashAuto ? t('camera.flashAuto') : t('camera.flashOff'),
            () => setFlashAuto((f) => !f),
          )}
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: spacing.lg,
            alignSelf: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
          }}
        >
          {([1, 2] as const).map((level) => (
            <Pressable
              key={level}
              accessibilityRole="button"
              accessibilityLabel={`Zoom ×${level}`}
              accessibilityState={{ selected: zoom === level }}
              onPress={() => void setZoomLevel(level)}
              style={{
                minWidth: 62,
                height: 48,
                borderRadius: 24,
                borderWidth: 2,
                borderColor: cam.ink,
                backgroundColor: zoom === level ? cam.ink : cam.scrim,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                variant="button"
                style={{ color: zoom === level ? cam.inkOnLight : cam.ink }}
              >
                {`×${level}`}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: cam.background }}>
        <View
          style={{
            height: 160,
            paddingHorizontal: spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('camera.lastPhoto')}
            disabled={!last}
            onPress={() =>
              last &&
              router.push({
                pathname: '/jobsite/[id]/photo/[photoId]',
                params: { id, photoId: last.id },
              })
            }
            style={{ width: 64, height: 64 }}
          >
            {last?.thumbUri ? (
              <Image
                testID="last-thumbnail"
                source={{ uri: last.thumbUri }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.sm,
                  borderWidth: 2,
                  borderColor: cam.ink,
                }}
              />
            ) : null}
            {last?.outsideGeofence ? (
              <View style={{ position: 'absolute', bottom: -10, left: -6 }}>
                <AppText variant="caption" style={{ color: cam.warn }}>
                  {t('camera.outside')}
                </AppText>
              </View>
            ) : null}
          </Pressable>
          <ShutterButton onPress={() => void capture()} disabled={capturing || !device} />
          {roundButton('check', t('camera.done'), () => router.back())}
        </View>
      </SafeAreaView>

      {alert ? (
        <View
          testID="quality-alert"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={{
            position: 'absolute',
            left: spacing.md,
            right: spacing.md,
            bottom: 176,
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.warn,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="alert-outline" color="warn" />
            <AppText variant="button" style={{ flex: 1 }}>
              {t(`quality.${alert.issue}`)}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <BigButton
                icon="camera-retake"
                label={t('quality.retake')}
                onPress={() => resolveAlert(false)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <BigButton
                variant="secondary"
                label={t('quality.keep')}
                onPress={() => resolveAlert(true)}
              />
            </View>
          </View>
        </View>
      ) : null}
      <Toast visible={error} message={t('camera.error')} onDismiss={() => setError(false)} />
    </View>
  );
}
