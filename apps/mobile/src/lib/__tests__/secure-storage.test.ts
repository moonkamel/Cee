import { secureStorage } from '../secure-storage';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

beforeEach(() => mockStore.clear());

describe('secureStorage', () => {
  it('découpe une longue session en morceaux de moins de 2 Ko et la reconstitue', async () => {
    const session = JSON.stringify({ token: 'x'.repeat(5000), user: { phone: '+33639980003' } });
    await secureStorage.setItem('sb-session', session);
    expect([...mockStore.values()].every((v) => v.length <= 1800)).toBe(true);
    expect(mockStore.get('sb-session.n')).toBe('3');
    expect(await secureStorage.getItem('sb-session')).toBe(session);
  });

  it('remplace proprement une valeur plus longue par une plus courte', async () => {
    await secureStorage.setItem('k', 'a'.repeat(4000));
    await secureStorage.setItem('k', 'court');
    expect(await secureStorage.getItem('k')).toBe('court');
    expect(mockStore.has('k.1')).toBe(false);
  });

  it('renvoie null pour une clé absente et efface tout à la déconnexion', async () => {
    expect(await secureStorage.getItem('absent')).toBeNull();
    await secureStorage.setItem('k', 'valeur');
    await secureStorage.removeItem('k');
    expect(mockStore.size).toBe(0);
  });
});
