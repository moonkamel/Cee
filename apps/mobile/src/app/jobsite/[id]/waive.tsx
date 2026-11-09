import { WAIVER_REASONS } from '@preuvio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, BigButton } from '@/components/ui';
import { useData } from '@/data/data-context';
import { useProofs } from '@/data/use-proofs';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Preuve « Impossible » (section 7) : un motif choisi dans une liste, en un tap.
// Le bureau voit la dispense tout de suite et la valide (ou demande une reprise).
export default function WaiveScreen() {
  const { id, slot } = useLocalSearchParams<{ id: string; slot: string }>();
  const data = useData();
  const { slots } = useProofs(id);
  const { spacing } = useTheme();
  const current = slots?.find((s) => s.id === slot);

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display" accessibilityRole="header">
          {t('waive.title')}
        </AppText>
        {current ? <AppText variant="title">{current.instruction}</AppText> : null}
        <AppText color="text-muted">{t('waive.choose')}</AppText>
      </View>
      {WAIVER_REASONS.map((reason) => (
        <BigButton
          key={reason}
          variant="secondary"
          label={t(`waive.reason.${reason}`)}
          onPress={() => {
            void data.waiveSlot(slot, reason).then(() => router.back());
          }}
        />
      ))}
      <BigButton
        variant="secondary"
        icon="close"
        label={t('waive.cancel')}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
