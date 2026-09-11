import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './types';

export class AsyncStorageStore implements KeyValueStore {
  constructor(private readonly prefix: string) {}

  private scoped(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async read<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(this.scoped(key));
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async write<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(this.scoped(key), JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(this.scoped(key));
  }

  async keys(): Promise<string[]> {
    const all = await AsyncStorage.getAllKeys();
    return all
      .filter((key) => key.startsWith(`${this.prefix}:`))
      .map((key) => key.slice(this.prefix.length + 1));
  }

  async clear(): Promise<void> {
    const scoped = await this.keys();
    await AsyncStorage.multiRemove(scoped.map((key) => this.scoped(key)));
  }
}
