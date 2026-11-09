import type { ColorToken, TypographyVariant } from '@preuvio/ui-tokens';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '@/theme/theme';

type Props = TextProps & { variant?: TypographyVariant; color?: ColorToken };

/** Texte de base : police, taille et couleur viennent uniquement des jetons. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const { typography, fontFamily, colors } = useTheme();
  const v = typography[variant];
  return (
    <Text
      maxFontSizeMultiplier={2}
      style={[
        {
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          fontFamily: v.weight === 'bold' ? fontFamily.bold : fontFamily.regular,
          color: colors[color],
        },
        style,
      ]}
      {...rest}
    />
  );
}
