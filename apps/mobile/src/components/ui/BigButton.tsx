import { Pressable, StyleSheet } from 'react-native';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** « primary » : un seul par écran, en couleur action. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityHint?: string;
};

/** Bouton principal : 64 px de haut, pleine largeur. */
export function BigButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  accessibilityHint,
}: Props) {
  const { colors, sizes, radius, spacing } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? 'on-action' : 'brand';

  return (
    <Pressable
      testID="big-button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: sizes.bigButton,
          borderRadius: radius.md,
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
          backgroundColor: primary ? colors.action : colors.surface,
          borderColor: primary ? colors.action : colors.brand,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} color={fg} /> : null}
      <AppText variant="button" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
