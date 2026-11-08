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
}: {
  name: IconName;
  color?: ColorToken;
  size?: number;
}) {
  const { colors, sizes } = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size ?? sizes.icon}
      color={colors[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
