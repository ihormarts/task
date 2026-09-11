import type { KeyValueStore } from './types';

export class MemoryStore implements KeyValueStore {
  private data: Map<string, string>;

  constructor(seed?: Map<string, string>) {
    this.data = seed ?? new Map();
  }

  async read<T>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }

  snapshot(): Map<string, string> {
    return new Map(this.data);
  }
}
