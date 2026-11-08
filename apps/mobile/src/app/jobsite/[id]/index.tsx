import { nextSlot, proofProgress, proofTone } from '@preuvio/shared';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { describeWork } from '@/components/JobsiteCard';
import { Screen } from '@/components/Screen';
import {
  AppText,
  BigButton,
  ChecklistRow,
  ProgressRing,
  QuestionCard,
  Toast,
} from '@/components/ui';
import { useData } from '@/data/data-context';
import { useJobsites } from '@/data/use-jobsites';
import { useOperations } from '@/data/use-operations';
import { useProofs } from '@/data/use-proofs';
import { t } from '@/i18n/fr';
import { pickFromGallery } from '@/lib/gallery';
import { processPhotoFile } from '@/lib/photo-pipeline';
import { useTheme } from '@/theme/theme';

// Fiche chantier : questions rapides (la checklist s'adapte), preuves attendues (un tap
// ouvre la caméra sur la bonne consigne), « Commencer » sur la prochaine preuve, import de
// la galerie en photo libre, puis « Fin de chantier ».
export default function JobsiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { result } = useJobsites();
  const { slots, photos } = useProofs(id);
  const operations = useOperations(id);
  const data = useData();
  const { spacing } = useTheme();
  const [imported, setImported] = useState(false);
  const jobsite = result?.data.find((j) => j.id === id);
  const { done, total } = proofProgress(slots ?? []);
  const next = slots ? nextSlot(slots) : null;
  const freeCount = photos.filter((p) => !p.proofSlotId).length;

  const openCamera = (slot?: string) =>
    router.push({ pathname: '/jobsite/[id]/camera', params: slot ? { id, slot } : { id } });

  async function importFromGallery() {
    const picked = await pickFromGallery();
    if (!picked) return;
    const photoId = randomUUID();
    const processed = await processPhotoFile(picked.uri, photoId, { copy: true, size: picked });
    await data.recordPhoto({
      id: photoId,
      jobsiteId: id,
      proofSlotId: null,
      takenAt: new Date().toISOString(),
      position: null,
      headingDeg: null,
      sha256: processed.sha256,
      source: 'gallery_import',
      width: picked.width,
      height: picked.height,
      localUri: processed.localUri,
      thumbUri: processed.thumbUri,
    });
    setImported(true);
  }

  return (
    <Screen>
      <BigButton
        variant="secondary"
        icon="arrow-left"
        label={t('jobsite.back')}
        onPress={() => router.back()}
      />
      {jobsite ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="display" accessibilityRole="header">
            {jobsite.address}
          </AppText>
          {jobsite.addressPending ? (
            <AppText color="warn">{t('jobsite.addressPending')}</AppText>
          ) : null}
          {jobsite.clientName ? <AppText color="text-muted">{jobsite.clientName}</AppText> : null}
          {describeWork(jobsite) ? <AppText>{describeWork(jobsite)}</AppText> : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        {total > 0 ? <ProgressRing done={done} total={total} size={96} /> : null}
        <View style={{ flex: 1 }}>
          <BigButton
            icon="camera"
            label={t('jobsite.start')}
            onPress={() => openCamera(next?.id)}
          />
        </View>
      </View>

      {operations.some((o) => o.questions.length > 0) ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="button" accessibilityRole="header">
            {t('jobsite.questions')}
          </AppText>
          {operations.flatMap((o) =>
            o.questions.map((q) =>
              q.type === 'yes_no' ? (
                <QuestionCard
                  key={`${o.id}:${q.key}`}
                  type="yes_no"
                  label={q.label}
                  value={q.value}
                  onChange={(v) => void data.answerQuestion(o.id, q.key, v)}
                />
              ) : (
                <QuestionCard
                  key={`${o.id}:${q.key}`}
                  type="number"
                  label={q.label}
                  value={q.value}
                  min={q.min}
                  max={q.max}
                  onChange={(v) => void data.answerQuestion(o.id, q.key, v)}
                />
              ),
            ),
          )}
        </View>
      ) : null}

      {slots && slots.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="button" accessibilityRole="header">
            {t('jobsite.proofs')}
          </AppText>
          {operations.some((o) => o.draft) ? (
            <AppText variant="caption" color="text-muted">
              {t('jobsite.draftTemplate')}
            </AppText>
          ) : null}
          {slots.map((s) => (
            <ChecklistRow
              key={s.id}
              label={s.instruction}
              icon="camera-outline"
              tone={proofTone(s.status)}
              onPress={() => openCamera(s.id)}
            />
          ))}
        </View>
      ) : (
        <AppText color="text-muted">{t('jobsite.noChecklist')}</AppText>
      )}

      {freeCount > 0 ? (
        <AppText color="text-muted">{t('jobsite.freePhotos', { count: freeCount })}</AppText>
      ) : null}
      <BigButton
        variant="secondary"
        icon="image-plus"
        label={t('jobsite.importPhoto')}
        onPress={() => void importFromGallery()}
      />
      {slots && slots.length > 0 ? (
        <BigButton
          variant="secondary"
          icon="flag-checkered"
          label={t('jobsite.finish')}
          onPress={() => router.push({ pathname: '/jobsite/[id]/summary', params: { id } })}
        />
      ) : null}
      <Toast
        visible={imported}
        message={t('jobsite.imported')}
        onDismiss={() => setImported(false)}
      />
    </Screen>
  );
}
