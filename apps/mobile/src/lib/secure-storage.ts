import * as SecureStore from 'expo-secure-store';

// La session Supabase dépasse parfois la limite de 2 Ko par entrée du trousseau :
// on la découpe en morceaux. Stockage chiffré par le système (Keychain / Keystore).
const CHUNK = 1800;

const chunkKey = (key: string, i: number) => `${key}.${i}`;
const countKey = (key: string) => `${key}.n`;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!n) return null;
    const parts = await Promise.all(
      Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    return parts.some((p) => p === null) ? null : parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, 'gs')) ?? [''];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(chunkKey(key, i), p)));
    await SecureStore.setItemAsync(countKey(key), String(parts.length));
  },

  async removeItem(key: string): Promise<void> {
    const n = Number(await SecureStore.getItemAsync(countKey(key)));
    await Promise.all(
      Array.from({ length: n || 0 }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
    );
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
