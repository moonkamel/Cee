import { normalizeFrenchPhone } from '@preuvio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/auth/auth';
import { BigInput } from '@/components/BigInput';
import { Screen } from '@/components/Screen';
import { AppText, BigButton } from '@/components/ui';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';

// Connexion, écran 2 sur 3. Le lien d'invitation (preuvio://login?phone=…) pré-remplit le numéro.
export default function LoginPhone() {
  const { auth } = useAuth();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [value, setValue] = useState(params.phone ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = normalizeFrenchPhone(value);

  async function submit() {
    if (!phone) return;
    setSending(true);
    setError(null);
    try {
      await auth.sendCode(phone);
      router.push({ pathname: '/login/code', params: { phone } });
    } catch {
      void haptics.error();
      setError(t('login.phone.error'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {t('login.phone.title')}
        </AppText>
        <AppText color="text-muted">{t('login.phone.hint')}</AppText>
      </View>
      <BigInput
        testID="phone-input"
        accessibilityLabel={t('login.phone.label')}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus={!params.phone}
        placeholder="06 12 34 56 78"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />
      {error ? (
        <AppText color="ko" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <BigButton
        label={t('login.phone.submit')}
        icon="message-text-outline"
        disabled={!phone || sending}
        accessibilityHint={phone ? undefined : t('login.phone.invalid')}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
