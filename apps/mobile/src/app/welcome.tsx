import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import { AppText, BigButton, Icon } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Premier lancement, écran 1 sur 3 (section 15). Vidéo de 30 s facultative, si son adresse
// est configurée (EXPO_PUBLIC_WELCOME_VIDEO_URL).
const VIDEO_URL = process.env.EXPO_PUBLIC_WELCOME_VIDEO_URL;
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
      {VIDEO_URL ? (
        <BigButton
          label={t('welcome.video')}
          icon="play-circle-outline"
          variant="secondary"
          onPress={() => void Linking.openURL(VIDEO_URL)}
        />
      ) : null}
      <BigButton label={t('welcome.start')} onPress={() => router.push('/login')} />
    </Screen>
  );
}
