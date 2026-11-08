import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ColorToken } from '@preuvio/ui-tokens';
import type { ComponentProps } from 'react';
import { useTheme } from '@/theme/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Icône décorative : le sens est toujours porté aussi par un mot. */
export function Icon({
  name,
  color = 'text',
  size,
  fixedColor,
}: {
  name: IconName;
  color?: ColorToken;
  size?: number;
  /** Couleur fixe, hors thème (écran caméra : toujours blanc sur noir). */
  fixedColor?: string;
}) {
  const { colors, sizes } = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size ?? sizes.icon}
      color={fixedColor ?? colors[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
