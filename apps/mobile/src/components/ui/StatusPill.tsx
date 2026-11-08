import type { ProofTone } from '@preuvio/shared';
import type { ColorToken } from '@preuvio/ui-tokens';
import { View } from 'react-native';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const TONE: Record<ProofTone, { color: ColorToken; icon: IconName }> = {
  ok: { color: 'ok', icon: 'check-circle' },
  warn: { color: 'warn', icon: 'alert' },
  ko: { color: 'ko', icon: 'close-circle' },
  pending: { color: 'text-muted', icon: 'timer-sand' },
  waived: { color: 'text-muted', icon: 'minus-circle' },
};

/** Statut : icône + mot + couleur, jamais la couleur seule. */
export function StatusPill({ tone, label }: { tone: ProofTone; label?: string }) {
  const { colors, radius, spacing, fontFamily } = useTheme();
  const { color, icon } = TONE[tone];
  const text = label ?? t(`status.${tone}`);
  return (
    <View
      testID={`status-pill-${tone}`}
      accessible
      accessibilityLabel={text}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 2,
        borderColor: colors[color],
        backgroundColor: colors.surface,
      }}
    >
      <Icon name={icon} color={color} size={20} />
      <AppText variant="caption" color={color} style={{ fontFamily: fontFamily.bold }}>
        {text}
      </AppText>
    </View>
  );
}
