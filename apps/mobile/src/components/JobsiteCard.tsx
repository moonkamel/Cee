import { proofProgress } from '@preuvio/shared';
import { View } from 'react-native';
import { AppText, BigButton, Icon, ProgressRing } from '@/components/ui';
import type { Jobsite } from '@/data/types';
import { t } from '@/i18n/fr';
import { formatDistance } from '@/lib/format';
import { useTheme } from '@/theme/theme';

type Props = {
  jobsite: Jobsite & { distanceM?: number | null; insideGeofence?: boolean };
  onPress: () => void;
  /** Grande carte plein écran : le chantier où se trouve le poseur. */
  featured?: boolean;
  actionLabel?: string;
};

/** Carte d'un chantier : adresse, client, opération, progression et une seule action. */
export function JobsiteCard({ jobsite, onPress, featured = false, actionLabel }: Props) {
  const { colors, spacing, radius } = useTheme();
  const { done, total } = proofProgress(jobsite.proofs);
  const where = jobsite.insideGeofence
    ? t('jobsite.here')
    : jobsite.distanceM != null
      ? t('jobsite.distance', { distance: formatDistance(jobsite.distanceM) })
      : null;

  return (
    <View
      testID={featured ? 'jobsite-card-featured' : 'jobsite-card'}
      style={{
        gap: spacing.md,
        padding: featured ? spacing.xl : spacing.lg,
        borderRadius: radius.lg,
        borderWidth: featured ? 3 : 1,
        borderColor: featured ? colors.action : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant={featured ? 'title' : 'button'} accessibilityRole="header">
            {jobsite.address}
          </AppText>
          {jobsite.clientName ? <AppText color="text-muted">{jobsite.clientName}</AppText> : null}
          {jobsite.operations.length > 0 ? (
            <AppText color="text-muted">{jobsite.operations.join(' · ')}</AppText>
          ) : null}
          {where ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon
                name={jobsite.insideGeofence ? 'map-marker-check' : 'map-marker-outline'}
                color="brand"
                size={20}
              />
              <AppText variant="caption" color="brand">
                {where}
              </AppText>
            </View>
          ) : null}
        </View>
        {total > 0 ? (
          <ProgressRing done={done} total={total} size={featured ? 96 : 72} />
        ) : (
          <AppText variant="caption" color="text-muted">
            {t('jobsite.noProofs')}
          </AppText>
        )}
      </View>
      <BigButton
        label={actionLabel ?? t('jobsite.start')}
        icon={featured ? 'camera' : undefined}
        variant={featured ? 'primary' : 'secondary'}
        accessibilityHint={jobsite.address}
        onPress={onPress}
      />
    </View>
  );
}
