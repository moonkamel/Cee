import {
  fontFamily,
  palette,
  radius,
  sizes,
  spacing,
  typography,
  type ColorScheme,
  type Palette,
} from '@preuvio/ui-tokens';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  sizes: typeof sizes;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  /** Bascule en un tap le mode « contraste maximal » (plein soleil). */
  toggleContrast: () => void;
  /** Force un mode (écran Catalogue) ; null = suivre le téléphone. */
  setSchemeOverride: (scheme: ColorScheme | null) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  children,
  initialScheme = null,
}: {
  children: ReactNode;
  initialScheme?: ColorScheme | null;
}) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [override, setSchemeOverride] = useState<ColorScheme | null>(initialScheme);
  const scheme = override ?? system;

  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: palette(scheme),
      spacing,
      radius,
      sizes,
      typography,
      fontFamily,
      toggleContrast: () => setSchemeOverride((s) => (s === 'contrast' ? null : 'contrast')),
      setSchemeOverride,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  return theme;
}
