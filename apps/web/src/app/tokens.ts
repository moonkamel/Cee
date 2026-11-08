import { palette, type ColorScheme } from '@preuvio/ui-tokens';

function cssVars(scheme: ColorScheme): string {
  return Object.entries(palette(scheme))
    .map(([token, value]) => `--color-${token}:${value};`)
    .join('');
}

/** Variables CSS générées depuis @preuvio/ui-tokens : aucune couleur codée en dur côté web. */
export const tokensCss = `:root{${cssVars('light')}}@media (prefers-color-scheme: dark){:root{${cssVars('dark')}}}`;
