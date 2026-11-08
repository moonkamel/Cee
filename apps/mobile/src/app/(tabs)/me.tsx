import * as Application from 'expo-application';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/auth/auth';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, ToggleRow } from '@/components/ui';
import { useData } from '@/data/data-context';
import type { Profile } from '@/data/types';
import { useSyncStatus } from '@/data/use-sync-status';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

export default function Me() {
  const { auth, userId } = useAuth();
  const data = useData();
  const status = useSyncStatus();
  const { spacing } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (userId) void data.getProfile(userId).then(setProfile);
  }, [data, userId]);
  useEffect(() => {
    void data.getWifiOnly().then(setWifiOnly, () => undefined);
  }, [data]);

  const photosWaiting = status?.photosWaiting ?? 0;
  const signOut = () => {
    // Des photos pas encore envoyées seraient perdues : un second tap le confirme.
    if (photosWaiting > 0 && !confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    // Les données de l'entreprise ne restent pas sur le téléphone après déconnexion.
    void data
      .reset()
      .then(() => auth.signOut())
      .then(() => router.replace('/welcome'));
  };

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
      <ToggleRow
        label={t('me.wifiOnly')}
        hint={t('me.wifiOnlyHint')}
        value={wifiOnly}
        onChange={(value) => {
          setWifiOnly(value);
          void data.setWifiOnly(value);
        }}
      />
      {confirmSignOut && photosWaiting > 0 ? (
        <AppText color="ko" accessibilityLiveRegion="assertive">
          {t('me.signOutWaiting', { count: photosWaiting })}
        </AppText>
      ) : null}
      <BigButton
        variant="secondary"
        icon="logout"
        label={confirmSignOut && photosWaiting > 0 ? t('me.signOutAnyway') : t('me.signOut')}
        onPress={signOut}
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
