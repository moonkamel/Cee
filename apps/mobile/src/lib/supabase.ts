import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { config } from './config';
import { secureStorage } from './secure-storage';

export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Rafraîchit la session seulement quand l'appli est au premier plan (économie de batterie).
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
