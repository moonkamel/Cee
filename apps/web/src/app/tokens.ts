import { palette, type ColorScheme } from '@preuvio/ui-tokens';

function cssVars(scheme: ColorScheme): string {
  return Object.entries(palette(scheme))
    .map(([token, value]) => `--color-${token}:${value};`)
    .join('');
}

/**
 * Variables CSS générées depuis @preuvio/ui-tokens : aucune couleur codée en dur côté web.
 * Le mode « contraste maximal » s'active avec l'attribut data-scheme="contrast" sur <html>.
 */
export const tokensCss =
  `:root{${cssVars('light')}}` +
  `@media (prefers-color-scheme: dark){:root{${cssVars('dark')}}}` +
  `:root[data-scheme="light"]{${cssVars('light')}}` +
  `:root[data-scheme="dark"]{${cssVars('dark')}}` +
  `:root[data-scheme="contrast"]{${cssVars('contrast')}}`;
