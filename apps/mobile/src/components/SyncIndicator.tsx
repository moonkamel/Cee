import { View } from 'react-native';
import { AppText, Icon } from '@/components/ui';
import { useSyncStatus } from '@/data/use-sync-status';
import { t } from '@/i18n/fr';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';

/**
 * Indicateur discret en haut d'écran : hors ligne, envois et photos en attente, refus (section 6).
 * `problemsOnly` (caméra) : seulement ce qui demande d'agir (réseau, batterie, Wi-Fi, refus),
 * sans le compte des photos en attente qui change à chaque prise.
 */
export function SyncIndicator({ problemsOnly = false }: { problemsOnly?: boolean } = {}) {
  const status = useSyncStatus();
  const { spacing } = useTheme();
  if (!status) return null;

  const paused =
    status.photosWaiting > 0 &&
    (status.uploadBlocked === 'battery' || status.uploadBlocked === 'wifi')
      ? status.uploadBlocked
      : null;
  const parts: string[] = [];
  if (status.offline) {
    parts.push(
      status.lastSyncAt
        ? t('today.offline', { time: formatTime(status.lastSyncAt) })
        : t('today.noNetwork'),
    );
  }
  if (status.pending > 0 && !problemsOnly) {
    parts.push(
      status.pending === 1 ? t('sync.pendingOne') : t('sync.pending', { count: status.pending }),
    );
  }
  if (status.photosWaiting > 0 && (!problemsOnly || paused)) {
    parts.push(
      status.photosWaiting === 1
        ? t('sync.photosWaitingOne')
        : t('sync.photosWaiting', { count: status.photosWaiting }),
    );
  }
  if (paused === 'battery') parts.push(t('sync.pausedBattery'));
  if (paused === 'wifi') parts.push(t('sync.pausedWifi'));
  if (status.rejected > 0) parts.push(t('sync.rejected', { count: status.rejected }));
  if (parts.length === 0) return null;
  // Pause batterie : le poseur doit agir (brancher), on la distingue du simple état.
  const tone = status.rejected > 0 ? 'ko' : paused === 'battery' ? 'warn' : 'text-muted';

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
              : paused === 'battery'
                ? 'battery-alert-variant-outline'
                : 'cloud-upload-outline'
        }
        color={tone}
        size={20}
      />
      <AppText variant="caption" color={tone} style={{ flexShrink: 1 }}>
        {parts.join(' · ')}
      </AppText>
    </View>
  );
}
