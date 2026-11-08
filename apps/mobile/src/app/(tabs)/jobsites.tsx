import { router } from 'expo-router';
import { JobsiteCard } from '@/components/JobsiteCard';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, EmptyState } from '@/components/ui';
import { useJobsites } from '@/data/use-jobsites';
import { t } from '@/i18n/fr';

// Tous les chantiers en cours ou planifiés visibles par l'utilisateur (la RLS fait le tri).
export default function Jobsites() {
  const { result, failed, refresh } = useJobsites();
  const jobsites = result?.data ?? [];

  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        {t('jobsites.title')}
      </AppText>
      <BigButton
        icon="plus"
        label={t('today.newJobsite')}
        onPress={() => router.push('/jobsite/new')}
      />
      {!result && failed ? (
        <EmptyState
          icon="cloud-off-outline"
          title={t('today.noNetwork')}
          actionLabel={t('today.retry')}
          onAction={() => void refresh()}
        />
      ) : null}
      {result && jobsites.length === 0 ? (
        <AppText color="text-muted">{t('jobsites.empty')}</AppText>
      ) : null}
      {jobsites.map((j) => (
        <JobsiteCard
          key={j.id}
          jobsite={j}
          actionLabel={t('jobsite.open')}
          onPress={() => router.push({ pathname: '/jobsite/[id]', params: { id: j.id } })}
        />
      ))}
    </Screen>
  );
}
