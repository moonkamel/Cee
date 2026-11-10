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
import { DataBootstrap } from '@/data/data-bootstrap';
import { supabase } from '@/lib/supabase';
import { startTelemetry } from '@/lib/telemetry';

void SplashScreen.preventAutoHideAsync();

const authService = createSupabaseAuth(supabase);

export default function RootLayout() {
  // Polices embarquées dans l'appli : aucun téléchargement au lancement (hors ligne par défaut).
  const [loaded, error] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  useEffect(() => startTelemetry(), []);

  if (!loaded && !error) return null;
  return (
    <AppProviders>
      <AuthProvider service={authService}>
        <DataBootstrap>
          <AppStack />
        </DataBootstrap>
      </AuthProvider>
    </AppProviders>
  );
}
