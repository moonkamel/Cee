import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppProviders } from '@/app-providers';
import { AppStack } from '@/app-stack';
import { AuthProvider, createSupabaseAuth } from '@/auth/auth';
import { DataProvider } from '@/data/data-context';
import { createSupabaseSource } from '@/data/supabase-source';
import { supabase } from '@/lib/supabase';

void SplashScreen.preventAutoHideAsync();

const authService = createSupabaseAuth(supabase);
const dataSource = createSupabaseSource(supabase);

export default function RootLayout() {
  // Polices embarquées dans l'appli : aucun téléchargement au lancement (hors ligne par défaut).
  const [loaded, error] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;
  return (
    <AppProviders>
      <AuthProvider service={authService}>
        <DataProvider source={dataSource}>
          <AppStack />
        </DataProvider>
      </AuthProvider>
    </AppProviders>
  );
}
