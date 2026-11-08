import { Pressable, View } from 'react-native';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';

/** Déclencheur photo de 88 px, retour haptique fort. */
export function ShutterButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { colors, sizes } = useTheme();
  const d = sizes.shutter;
  return (
    <Pressable
      testID="shutter-button"
      accessibilityRole="button"
      accessibilityLabel={t('shutter.label')}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        void haptics.photoTaken();
        onPress();
      }}
      style={({ pressed }) => ({
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: 6,
        borderColor: colors['on-action'],
        backgroundColor: colors.action,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <View
        style={{
          width: d * 0.55,
          height: d * 0.55,
          borderRadius: d,
          backgroundColor: colors['on-action'],
        }}
      />
    </Pressable>
  );
}
