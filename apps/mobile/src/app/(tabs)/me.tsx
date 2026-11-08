import * as Application from 'expo-application';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/auth/auth';
import { Screen } from '@/components/Screen';
import { AppText, BigButton } from '@/components/ui';
import { useData } from '@/data/data-context';
import type { Profile } from '@/data/types';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

export default function Me() {
  const { auth, userId } = useAuth();
  const data = useData();
  const { spacing } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (userId) void data.getProfile(userId).then(setProfile);
  }, [data, userId]);

  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        {t('me.title')}
      </AppText>
      {profile ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title">{profile.fullName}</AppText>
          <AppText color="text-muted">
            {[t(`role.${profile.role}`), profile.companyName].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      ) : null}
      <BigButton
        variant="secondary"
        icon="logout"
        label={t('me.signOut')}
        onPress={() => {
          void auth.signOut().then(() => router.replace('/welcome'));
        }}
      />
      {__DEV__ ? (
        <BigButton
          variant="secondary"
          icon="palette-swatch-outline"
          label={t('catalogue.open')}
          onPress={() => router.push('/catalogue')}
        />
      ) : null}
      <AppText variant="caption" color="text-muted">
        {t('me.version', { version: Application.nativeApplicationVersion ?? '0.0.0' })}
      </AppText>
    </Screen>
  );
}
