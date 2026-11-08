import { checklistSummary } from '@preuvio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, ChecklistRow, ProgressRing } from '@/components/ui';
import { useData } from '@/data/data-context';
import { useProofs } from '@/data/use-proofs';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Écran de fin de chantier (sections 2 et 7) : « 9 preuves sur 9 » ou la liste des manques,
// chacun ouvrant la caméra. Terminer avec des manques reste possible, après confirmation :
// le poseur n'est jamais bloqué sur place, le bureau voit le chantier « à risque ».
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const { slots } = useProofs(id);
  const { spacing } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const summary = checklistSummary(slots ?? []);

  const openCamera = (slot: string) =>
    router.push({ pathname: '/jobsite/[id]/camera', params: { id, slot } });
  const waive = (slot: string) =>
    router.push({ pathname: '/jobsite/[id]/waive', params: { id, slot } });

  const finish = () => {
    if (!summary.complete && !confirm) {
      setConfirm(true);
      return;
    }
    void data.finishJobsite(id).then(() => router.replace('/'));
  };

  return (
    <Screen>
      <BigButton
        variant="secondary"
        icon="arrow-left"
        label={t('jobsite.back')}
        onPress={() => router.back()}
      />
      <AppText variant="display" accessibilityRole="header">
        {t('summary.title')}
      </AppText>

      {slots && slots.length === 0 ? (
        <AppText color="text-muted">{t('summary.noChecklist')}</AppText>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <ProgressRing done={summary.done} total={summary.total} size={96} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="title">
              {t('summary.count', { done: summary.done, total: summary.total })}
            </AppText>
            <AppText color={summary.complete ? 'ok' : 'ko'}>
              {summary.complete
                ? t('summary.complete')
                : t('summary.missing', { count: summary.missing.length })}
            </AppText>
          </View>
        </View>
      )}

      {summary.missing.map((s) => (
        <View key={s.id} style={{ gap: spacing.xs }}>
          <ChecklistRow
            label={s.instruction}
            icon="camera-outline"
            tone="ko"
            onPress={() => openCamera(s.id)}
          />
          <BigButton
            variant="secondary"
            icon="cancel"
            label={`${t('waive.action')} : ${s.instruction}`}
            onPress={() => waive(s.id)}
          />
        </View>
      ))}

      {summary.optionalMissing.length > 0 ? (
        <AppText color="text-muted">
          {t('summary.optional', { count: summary.optionalMissing.length })}
        </AppText>
      ) : null}
      {summary.waiversPending.length > 0 ? (
        <AppText color="warn">
          {t('summary.waivers', { count: summary.waiversPending.length })}
        </AppText>
      ) : null}

      {confirm && !summary.complete ? (
        <AppText color="ko" accessibilityLiveRegion="assertive">
          {t('summary.warning')}
        </AppText>
      ) : null}
      <BigButton
        icon="flag-checkered"
        label={confirm && !summary.complete ? t('summary.finishAnyway') : t('summary.finish')}
        onPress={finish}
      />
    </Screen>
  );
}
