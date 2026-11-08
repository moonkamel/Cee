import { View } from 'react-native';
import { AppText, Icon } from '@/components/ui';
import { useSyncStatus } from '@/data/use-sync-status';
import { t } from '@/i18n/fr';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';

/** Indicateur discret en haut d'écran : hors ligne, envois en attente ou refusés (section 6). */
export function SyncIndicator() {
  const status = useSyncStatus();
  const { spacing } = useTheme();
  if (!status) return null;

  const parts: string[] = [];
  if (status.offline) {
    parts.push(
      status.lastSyncAt
        ? t('today.offline', { time: formatTime(status.lastSyncAt) })
        : t('today.noNetwork'),
    );
  }
  if (status.pending > 0) {
    parts.push(
      status.pending === 1 ? t('sync.pendingOne') : t('sync.pending', { count: status.pending }),
    );
  }
  if (status.rejected > 0) parts.push(t('sync.rejected', { count: status.rejected }));
  if (parts.length === 0) return null;

  return (
    <View
      testID="sync-indicator"
      accessible
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
    >
      <Icon
        name={
          status.rejected > 0
            ? 'cloud-alert'
            : status.offline
              ? 'cloud-off-outline'
              : 'cloud-upload-outline'
        }
        color={status.rejected > 0 ? 'ko' : 'text-muted'}
        size={20}
      />
      <AppText variant="caption" color={status.rejected > 0 ? 'ko' : 'text-muted'}>
        {parts.join(' · ')}
      </AppText>
    </View>
  );
}
