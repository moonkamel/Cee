import { formatFrenchPhone } from '@preuvio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/auth/auth';
import { BigInput } from '@/components/BigInput';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, Toast } from '@/components/ui';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';

const CODE_LENGTH = 6;

// Le code SMS se remplit tout seul (iOS : oneTimeCode, Android : sms-otp) et se valide seul :
// aucun tap ni clavier nécessaire quand le téléphone le propose.
export default function LoginCode() {
  const { auth } = useAuth();
  const { spacing } = useTheme();
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify(value: string) {
    setChecking(true);
    try {
      await auth.verifyCode(phone, value);
      void haptics.proofValidated();
      router.replace('/');
    } catch {
      void haptics.error();
      setError(t('login.code.error'));
      setCode('');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {t('login.code.title')}
        </AppText>
        <AppText color="text-muted">
          {t('login.code.sentTo', { phone: formatFrenchPhone(phone) })}
        </AppText>
      </View>
      <BigInput
        testID="code-input"
        accessibilityLabel={t('login.code.label')}
        value={code}
        editable={!checking}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
          setCode(digits);
          setError(null);
          if (digits.length === CODE_LENGTH) void verify(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={CODE_LENGTH}
        placeholder="••••••"
        style={{ textAlign: 'center', letterSpacing: 12 }}
      />
      {error ? (
        <AppText color="ko" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <BigButton
        variant="secondary"
        label={t('login.code.resend')}
        icon="refresh"
        onPress={() => {
          void auth.sendCode(phone).then(
            () => setResent(true),
            () => setError(t('login.phone.error')),
          );
        }}
      />
      <Toast visible={resent} message={t('login.code.resent')} onDismiss={() => setResent(false)} />
    </Screen>
  );
}
