import type { ConfirmedMessage, MessageAuthor, MessageKind } from '../../domain/message';
import type { KeyValueStore } from '../../storage/types';
import { SERVER_KEYS } from '../../storage/storageKeys';
import { generateHistoryMessage, generateHistoryRange, historyTimestampFor } from './historyGenerator';

export const DEFAULT_HISTORY_SIZE = 50_000;

export type AcceptRequest = {
  clientId: string;
  text: string;
  author: MessageAuthor;
};

export type IncomingDraft = {
  text: string;
  kind?: MessageKind;
  amountCents?: number;
};

export type AcceptResult = {
  message: ConfirmedMessage;
  deduplicated: boolean;
};

export type PageRequest = {
  beforeSeq: number | null;
  limit: number;
};

export type Page = {
  messages: ConfirmedMessage[];
  oldestSeq: number | null;
  hasMore: boolean;
};

export type MockChatServerOptions = {
  store: KeyValueStore;
  historySize?: number;
  idempotency?: boolean;
};

export class MockChatServer {
  private readonly store: KeyValueStore;

  private readonly historySize: number;

  private readonly idempotency: boolean;

  private acceptedClientIds = new Map<string, string>();

  private appended: ConfirmedMessage[] = [];

  private loaded = false;

  constructor(options: MockChatServerOptions) {
    this.store = options.store;
    this.historySize = options.historySize ?? DEFAULT_HISTORY_SIZE;
    this.idempotency = options.idempotency ?? true;
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const accepted = await this.store.read<Record<string, string>>(SERVER_KEYS.acceptedClientIds);
    const appended = await this.store.read<ConfirmedMessage[]>(SERVER_KEYS.appendedMessages);
    this.acceptedClientIds = new Map(Object.entries(accepted ?? {}));
    this.appended = appended ?? [];
    this.loaded = true;
  }

  get headSeq(): number {
    const lastAppended = this.appended[this.appended.length - 1];
    return lastAppended ? lastAppended.seq : this.historySize;
  }

  async accept(request: AcceptRequest): Promise<AcceptResult> {
    await this.load();

    if (this.idempotency) {
      const existingId = this.acceptedClientIds.get(request.clientId);
      if (existingId) {
        const existing = this.appended.find((message) => message.id === existingId);
        if (existing) {
          return { message: existing, deduplicated: true };
        }
      }
    }

    const message: ConfirmedMessage = {
      id: `srv_${this.headSeq + 1}`,
      clientId: request.clientId,
      seq: this.headSeq + 1,
      author: request.author,
      kind: 'text',
      text: request.text,
      createdAt: Date.now(),
    };

    this.appended.push(message);
    this.acceptedClientIds.set(request.clientId, message.id);
    await this.persist();

    return { message, deduplicated: false };
  }

  async appendIncoming(drafts: IncomingDraft[]): Promise<ConfirmedMessage[]> {
    await this.load();

    const created = drafts.map((draft, index) => ({
      id: `srv_${this.headSeq + 1 + index}`,
      clientId: null,
      seq: this.headSeq + 1 + index,
      author: 'creator' as MessageAuthor,
      kind: draft.kind ?? ('text' as MessageKind),
      text: draft.text,
      amountCents: draft.amountCents,
      createdAt: Date.now() + index,
    }));

    this.appended.push(...created);
    await this.persist();

    return created;
  }

  async fetchPage(request: PageRequest): Promise<Page> {
    await this.load();

    const upperSeq = request.beforeSeq === null ? this.headSeq : request.beforeSeq - 1;
    if (upperSeq < 1) {
      return { messages: [], oldestSeq: null, hasMore: false };
    }

    const lowerSeq = Math.max(1, upperSeq - request.limit + 1);
    const messages = this.readRange(lowerSeq, upperSeq);

    return {
      messages,
      oldestSeq: messages.length > 0 ? messages[0].seq : null,
      hasMore: lowerSeq > 1,
    };
  }

  async pullSince(seq: number): Promise<ConfirmedMessage[]> {
    await this.load();
    if (seq >= this.headSeq) {
      return [];
    }
    return this.readRange(seq + 1, this.headSeq);
  }

  async reset(): Promise<void> {
    this.acceptedClientIds.clear();
    this.appended = [];
    this.loaded = true;
    await this.persist();
  }

  private readRange(fromSeq: number, toSeq: number): ConfirmedMessage[] {
    const historyTo = Math.min(toSeq, this.historySize);
    const history = fromSeq <= historyTo ? generateHistoryRange(fromSeq, historyTo) : [];
    const appended = this.appended.filter(
      (message) => message.seq >= fromSeq && message.seq <= toSeq,
    );
    return [...history, ...appended];
  }

  private async persist(): Promise<void> {
    await this.store.write(
      SERVER_KEYS.acceptedClientIds,
      Object.fromEntries(this.acceptedClientIds),
    );
    await this.store.write(SERVER_KEYS.appendedMessages, this.appended);
  }
}

export { generateHistoryMessage, historyTimestampFor };
