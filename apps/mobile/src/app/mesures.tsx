import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, BigButton } from '@/components/ui';
import { t, type TranslationKey } from '@/i18n/fr';
import { perfSummary, type PerfMetric, recentSamples } from '@/lib/telemetry';
import { useTheme } from '@/theme/theme';

// Écran caché (appui long sur la version, dans « Moi ») : les mesures de la section 17 sur ce
// téléphone, à relever sur le téléphone de référence (Android d'entrée de gamme).
const LABELS: Record<PerfMetric, TranslationKey> = {
  cold_start_to_camera: 'mesures.coldStart',
  shutter_to_saved: 'mesures.shutter',
  local_check: 'mesures.localCheck',
};

export default function Mesures() {
  const { spacing, colors } = useTheme();
  const [rows, setRows] = useState(() => perfSummary(recentSamples()));
  useEffect(() => {
    const timer = setInterval(() => setRows(perfSummary(recentSamples())), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        {t('mesures.title')}
      </AppText>
      <AppText color="text-muted">{t('mesures.hint')}</AppText>
      {rows.map((r) => (
        <View
          key={r.metric}
          accessible
          style={{
            gap: spacing.xs,
            padding: spacing.md,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText style={{ fontWeight: '700' }}>{t(LABELS[r.metric])}</AppText>
          <AppText color={r.ok === null ? 'text-muted' : r.ok ? 'ok' : 'ko'}>
            {r.median === null
              ? t('mesures.none')
              : t('mesures.value', {
                  median: r.median,
                  worst: r.worst ?? 0,
                  target: r.target,
                  count: r.count,
                })}
          </AppText>
        </View>
      ))}
      <BigButton label={t('mesures.back')} icon="arrow-left" onPress={() => router.back()} />
    </Screen>
  );
}
