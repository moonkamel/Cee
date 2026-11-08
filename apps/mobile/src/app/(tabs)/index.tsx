import { featuredJobsite, selectTodayJobsites } from '@preuvio/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { JobsiteCard } from '@/components/JobsiteCard';
import { Screen } from '@/components/Screen';
import { AppText, EmptyState, Icon, Toast } from '@/components/ui';
import { useJobsites } from '@/data/use-jobsites';
import { t } from '@/i18n/fr';
import { formatLongDate, formatTime } from '@/lib/format';
import { localToday, useCurrentPosition } from '@/lib/position';
import { useTheme } from '@/theme/theme';

// Écran « Aujourd'hui » (section 6) : le chantier le plus proche en tête,
// celui où se trouve le poseur en plein écran avec un bouton géant « Commencer ».
export default function Today() {
  const { spacing } = useTheme();
  const { result, failed, refresh } = useJobsites();
  const position = useCurrentPosition();
  const [soon, setSoon] = useState(false);

  const today = localToday();
  const jobsites = useMemo(
    () => selectTodayJobsites(result?.data ?? [], today, position),
    [result, today, position],
  );
  const featured = featuredJobsite(jobsites);
  const others = jobsites.filter((j) => j.id !== featured?.id);
  const open = (id: string) => router.push({ pathname: '/jobsite/[id]', params: { id } });

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display" accessibilityRole="header">
          {t('today.title')}
        </AppText>
        <AppText color="text-muted" style={{ textTransform: 'capitalize' }}>
          {formatLongDate(new Date())}
        </AppText>
        {result?.stale ? (
          <View
            testID="offline-banner"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          >
            <Icon name="cloud-off-outline" color="text-muted" size={20} />
            <AppText variant="caption" color="text-muted">
              {t('today.offline', { time: formatTime(result.fetchedAt) })}
            </AppText>
          </View>
        ) : null}
      </View>

      {!result && !failed ? <AppText color="text-muted">{t('today.loading')}</AppText> : null}

      {!result && failed ? (
        <EmptyState
          icon="cloud-off-outline"
          title={t('today.noNetwork')}
          actionLabel={t('today.retry')}
          onAction={() => void refresh()}
        />
      ) : null}

      {result && jobsites.length === 0 ? (
        <EmptyState
          icon="calendar-blank-outline"
          title={t('today.empty')}
          actionLabel={t('today.newJobsite')}
          onAction={() => setSoon(true)} // création rapide de chantier : session S5
        />
      ) : null}

      {featured ? (
        <JobsiteCard featured jobsite={featured} onPress={() => open(featured.id)} />
      ) : null}

      {others.length > 0 && featured ? (
        <AppText variant="caption" color="text-muted">
          {t('today.others')}
        </AppText>
      ) : null}
      {others.map((j) => (
        <JobsiteCard key={j.id} jobsite={j} onPress={() => open(j.id)} />
      ))}

      <Toast visible={soon} message={t('today.newJobsiteSoon')} onDismiss={() => setSoon(false)} />
    </Screen>
  );
}
