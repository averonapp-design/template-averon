import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@avcache2_";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export const apiCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      return entry.data ?? null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    try {
      const entry: CacheEntry<T> = { data, ts: Date.now() };
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {}
  },

  async clear(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(PREFIX) || k.startsWith("@averon_"));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch {}
  },
};
