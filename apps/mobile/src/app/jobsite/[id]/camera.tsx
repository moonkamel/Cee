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
import { processPhotoFile } from '@/lib/photo-pipeline';
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

  useEffect(() => {
    if (!permission.hasPermission) void permission.requestPermission();
  }, [permission]);

  // Sans preuve demandée : la prochaine à prendre, ou photo libre si tout est pris.
  const currentId =
    chosenId !== undefined ? chosenId : slots ? (nextSlot(slots)?.id ?? null) : null;

  const current = slots?.find((s) => s.id === currentId) ?? null;
  const { done, total } = proofProgress(slots ?? []);
  const rank = current && slots ? slotRank(slots, current.id) : null;
  const allDone = !!slots && slots.length > 0 && nextSlot(slots) === null;
  const last = photos[0];

  async function capture() {
    if (capturing) return;
    setCapturing(true);
    const takenAt = new Date().toISOString();
    const position = positionForPhoto(); // en parallèle de la prise de vue
    const photoId = randomUUID();
    try {
      const file = await photoOutput.capturePhotoToFile(
        { flashMode: flashAuto ? 'auto' : 'off' },
        {},
      );
      // La rafale reprend dès que le fichier existe ; le traitement continue en arrière-plan.
      setCapturing(false);
      const slotId = current?.id ?? null;
      const processed = await processPhotoFile(file.filePath, photoId, {
        size: { width: file.width, height: file.height },
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
      });
      console.info('[photo] enregistrée', { ...processed.timings });
      if (slotId && slots) {
        const after = slots.map((s) =>
          s.id === slotId ? { ...s, status: 'captured' as const } : s,
        );
        setCurrentId(nextSlot(after, slotId)?.id ?? null);
        void haptics.proofValidated();
      }
    } catch {
      setCapturing(false);
      void haptics.error();
      setError(true);
    }
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
          <View
            accessible
            accessibilityLabel={t('camera.lastPhoto')}
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
          </View>
          <ShutterButton onPress={() => void capture()} disabled={capturing || !device} />
          {roundButton('check', t('camera.done'), () => router.back())}
        </View>
      </SafeAreaView>

      <Toast visible={error} message={t('camera.error')} onDismiss={() => setError(false)} />
    </View>
  );
}
