import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText, BigButton, Icon } from '@/components/ui';
import { usePhotoRequests } from '@/data/use-photo-requests';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

/** « Photo à reprendre » demandée par le bureau : un tap ouvre la caméra sur la bonne preuve. */
export function PhotoRequestBanners({
  jobsiteId,
  showAddress = false,
}: {
  jobsiteId?: string;
  showAddress?: boolean;
}) {
  const requests = usePhotoRequests(jobsiteId);
  const { colors, spacing, radius } = useTheme();
  return requests.map((r) => (
    <View
      key={r.id}
      testID="photo-request"
      accessibilityRole="alert"
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.warn,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="camera-retake-outline" color="warn" />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="button">{t('request.title')}</AppText>
          {showAddress && r.jobsiteAddress ? (
            <AppText color="text-muted">{r.jobsiteAddress}</AppText>
          ) : null}
          {r.instruction ? <AppText>{r.instruction}</AppText> : null}
          {r.message ? (
            <AppText color="text-muted">{t('request.message', { message: r.message })}</AppText>
          ) : null}
        </View>
      </View>
      <BigButton
        icon="camera"
        label={t('request.retake')}
        onPress={() =>
          router.push({
            pathname: '/jobsite/[id]/camera',
            params: r.proofSlotId ? { id: r.jobsiteId, slot: r.proofSlotId } : { id: r.jobsiteId },
          })
        }
      />
    </View>
  ));
}
