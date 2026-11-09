import { View } from 'react-native';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { BigButton } from './BigButton';
import { Icon } from './Icon';

type Props = { instruction: string; message: string; onRetake: () => void; onKeep: () => void };

/** Alerte orange du pré-contrôle IA (section 8) : message court, « Reprendre » ou « Garder quand même ». */
export function AiAlertCard({ instruction, message, onRetake, onKeep }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      testID="ai-alert"
      accessibilityRole="alert"
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.warn,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="alert-outline" color="warn" />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" color="text-muted">
            {instruction}
          </AppText>
          <AppText variant="button">{message}</AppText>
        </View>
      </View>
      <BigButton icon="camera-retake" label={t('ai.retake')} onPress={onRetake} />
      <BigButton variant="secondary" label={t('ai.keep')} onPress={onKeep} />
    </View>
  );
}
