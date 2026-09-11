import { createClientId } from '../../lib/ids';
import { CLIENT_KEYS } from '../../storage/storageKeys';
import type { PendingFailure, PendingMessage, PendingStatus } from '../../domain/message';
import type { KeyValueStore } from '../../storage/types';

export class Outbox {
  private entries: PendingMessage[] = [];

  private loaded = false;

  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<PendingMessage[]> {
    if (this.loaded) {
      return this.entries;
    }
    const stored = await this.store.read<PendingMessage[]>(CLIENT_KEYS.outbox);
    this.entries = (stored ?? []).map((entry) =>
      entry.status === 'sending' ? { ...entry, status: 'queued' } : entry,
    );
    this.loaded = true;
    await this.persist();
    return this.entries;
  }

  list(): PendingMessage[] {
    return this.entries;
  }

  async enqueue(text: string): Promise<PendingMessage> {
    await this.load();

    const entry: PendingMessage = {
      clientId: createClientId(),
      text,
      createdAt: Date.now(),
      status: 'queued',
      attempts: 0,
      failure: null,
    };

    this.entries = [...this.entries, entry];
    await this.persist();

    return entry;
  }

  async markSending(clientId: string): Promise<void> {
    await this.patch(clientId, (entry) => ({
      ...entry,
      status: 'sending' as PendingStatus,
      attempts: entry.attempts + 1,
      failure: null,
    }));
  }

  async markQueued(clientId: string, failure: PendingFailure): Promise<void> {
    await this.patch(clientId, (entry) => ({
      ...entry,
      status: 'queued' as PendingStatus,
      failure,
    }));
  }

  async markFailed(clientId: string, failure: PendingFailure): Promise<void> {
    await this.patch(clientId, (entry) => ({
      ...entry,
      status: 'failed' as PendingStatus,
      failure,
    }));
  }

  async retry(clientId: string): Promise<void> {
    await this.patch(clientId, (entry) => ({
      ...entry,
      status: 'queued' as PendingStatus,
      failure: null,
    }));
  }

  async remove(clientId: string): Promise<void> {
    await this.load();
    this.entries = this.entries.filter((entry) => entry.clientId !== clientId);
    await this.persist();
  }

  async clear(): Promise<void> {
    this.entries = [];
    this.loaded = true;
    await this.persist();
  }

  private async patch(
    clientId: string,
    update: (entry: PendingMessage) => PendingMessage,
  ): Promise<void> {
    await this.load();
    this.entries = this.entries.map((entry) =>
      entry.clientId === clientId ? update(entry) : entry,
    );
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.store.write(CLIENT_KEYS.outbox, this.entries);
  }
}
