import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Opérations de connexion, séparées de Supabase pour les tests. */
export interface AuthService {
  currentUserId(): Promise<string | null>;
  onChange(listener: (userId: string | null) => void): () => void;
  /** Envoie le code par SMS. Le numéro est au format +33… */
  sendCode(phone: string): Promise<void>;
  verifyCode(phone: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}

export function createSupabaseAuth(client: SupabaseClient): AuthService {
  return {
    async currentUserId() {
      const { data } = await client.auth.getSession();
      return data.session?.user.id ?? null;
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(session?.user.id ?? null),
      );
      return () => data.subscription.unsubscribe();
    },
    async sendCode(phone) {
      // shouldCreateUser: false — seuls les salariés invités peuvent se connecter.
      const { error } = await client.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
    },
    async verifyCode(phone, code) {
      const { error } = await client.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error) throw error;
    },
    async signOut() {
      await client.auth.signOut();
    },
  };
}

type AuthState = { status: 'loading' | 'signedOut' | 'signedIn'; userId: string | null };
type AuthContextValue = AuthState & { auth: AuthService };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', userId: null });

  useEffect(() => {
    let alive = true;
    void service.currentUserId().then((userId) => {
      if (alive) setState({ status: userId ? 'signedIn' : 'signedOut', userId });
    });
    const unsubscribe = service.onChange((userId) =>
      setState({ status: userId ? 'signedIn' : 'signedOut', userId }),
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [service]);

  const value = useMemo(() => ({ ...state, auth: service }), [state, service]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return value;
}
