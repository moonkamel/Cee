import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText, BigButton, Icon } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Premier lancement, écran 1 sur 3 (section 15).
export default function Welcome() {
  const { spacing } = useTheme();
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <Icon name="camera-marker-outline" color="brand" size={96} />
        <AppText variant="display" color="brand" accessibilityRole="header">
          {t('welcome.title')}
        </AppText>
        <AppText>{t('welcome.body')}</AppText>
      </View>
      <BigButton label={t('welcome.start')} onPress={() => router.push('/login')} />
    </Screen>
  );
}
