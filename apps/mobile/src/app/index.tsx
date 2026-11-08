import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, BigButton } from '@/components/ui';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Écran provisoire : l'écran « Aujourd'hui » arrive en session S4.
export default function Home() {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <AppText variant="display" color="brand" accessibilityRole="header">
          Preuvio
        </AppText>
        <AppText>{t('app.tagline')}</AppText>
        {__DEV__ ? (
          <BigButton
            variant="secondary"
            icon="palette-swatch-outline"
            label={t('catalogue.open')}
            onPress={() => router.push('/catalogue')}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
