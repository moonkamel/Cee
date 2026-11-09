import { TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/theme';

/** Champ de saisie géant : chiffres lisibles en plein soleil, cible tactile large. */
export function BigInput(props: TextInputProps) {
  const { colors, fontFamily, radius, spacing, sizes } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors['text-muted']}
      maxFontSizeMultiplier={1.6}
      {...props}
      style={[
        {
          minHeight: sizes.bigButton,
          paddingHorizontal: spacing.lg,
          borderWidth: 2,
          borderRadius: radius.md,
          borderColor: colors.brand,
          backgroundColor: colors.surface,
          color: colors.text,
          fontFamily: fontFamily.bold,
          fontSize: 28,
          letterSpacing: 2,
        },
        props.style,
      ]}
    />
  );
}
