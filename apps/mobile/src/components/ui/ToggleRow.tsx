import { Pressable, View } from 'react-native';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void };

/** Réglage oui/non : toute la ligne se touche (gants), l'état est écrit en toutes lettres. */
export function ToggleRow({ label, hint, value, onChange }: Props) {
  const { colors, spacing, sizes, radius } = useTheme();
  return (
    <Pressable
      testID="toggle-row"
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => {
        void haptics.tap();
        onChange(!value);
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
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="text-muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" color={value ? 'brand' : 'text-muted'}>
        {value ? t('toggle.on') : t('toggle.off')}
      </AppText>
      <Icon
        name={value ? 'toggle-switch' : 'toggle-switch-off-outline'}
        color={value ? 'brand' : 'text-muted'}
        size={sizes.iconLarge}
      />
    </Pressable>
  );
}
