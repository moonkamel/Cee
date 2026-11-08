import { proofProgress } from '@preuvio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, ProgressRing } from '@/components/ui';
import { useJobsites } from '@/data/use-jobsites';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Fiche chantier. La caméra guidée et la checklist arrivent en sessions S6 et S8.
export default function JobsiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { result } = useJobsites();
  const { spacing } = useTheme();
  const jobsite = result?.data.find((j) => j.id === id);
  const { done, total } = proofProgress(jobsite?.proofs ?? []);

  return (
    <Screen>
      <BigButton
        variant="secondary"
        icon="arrow-left"
        label={t('jobsite.back')}
        onPress={() => router.back()}
      />
      {jobsite ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="display" accessibilityRole="header">
            {jobsite.address}
          </AppText>
          {jobsite.clientName ? <AppText color="text-muted">{jobsite.clientName}</AppText> : null}
          {jobsite.operations.length > 0 ? (
            <AppText>{jobsite.operations.join(' · ')}</AppText>
          ) : null}
          {total > 0 ? <ProgressRing done={done} total={total} size={120} /> : null}
          <AppText color="text-muted">{t('jobsite.cameraSoon')}</AppText>
        </View>
      ) : null}
    </Screen>
  );
}
