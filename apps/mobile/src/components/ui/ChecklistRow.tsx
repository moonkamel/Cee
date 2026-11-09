import type { ProofTone } from '@preuvio/shared';
import { Pressable, View } from 'react-native';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { StatusPill } from './StatusPill';

type Props = { label: string; icon: IconName; tone: ProofTone; onPress: () => void };

/** Une preuve attendue : pictogramme, libellé, état ; un tap ouvre la caméra. */
export function ChecklistRow({ label, icon, tone, onPress }: Props) {
  const { colors, spacing, sizes, radius } = useTheme();
  return (
    <Pressable
      testID="checklist-row"
      accessibilityRole="button"
      accessibilityLabel={`${t('checklist.photograph', { label })}. ${t(`status.${tone}`)}`}
      onPress={() => {
        void haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: sizes.touchMin + spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} color="brand" size={sizes.iconLarge} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText>{label}</AppText>
        <StatusPill tone={tone} />
      </View>
      <Icon name="camera" color="action" />
    </Pressable>
  );
}
