import { createStore } from 'zustand/vanilla';

import { backoffDelay } from '../../lib/delay';
import { describeFailure, isTransportError } from '../../domain/errors';
import { CLIENT_KEYS } from '../../storage/storageKeys';
import { Outbox } from './outbox';
import {
  buildThread,
  dropConfirmedFromOutbox,
  highestSeq,
  mergeConfirmed,
} from './threadMerge';
import type { ConfirmedMessage, PendingMessage, ThreadItem } from '../../domain/message';
import type { ChatTransport } from '../../services/chat/chatTransport';
import type { KeyValueStore } from '../../storage/types';
import type { NetworkConditions } from '../../services/chat/networkConditions';

export const HISTORY_PAGE_SIZE = 40;
const PERSISTED_TAIL_SIZE = 60;

export type ConnectionState = 'online' | 'offline' | 'syncing';

export type ChatState = {
  confirmed: ConfirmedMessage[];
  pending: PendingMessage[];
  thread: ThreadItem[];
  oldestLoadedSeq: number | null;
  hasMoreHistory: boolean;
  lastSeenSeq: number;
  connection: ConnectionState;
  loadingOlder: boolean;
  ready: boolean;
};

export type ChatActions = {
  initialize: () => Promise<void>;
  send: (text: string) => Promise<void>;
  flush: () => Promise<void>;
  pull: () => Promise<void>;
  loadOlder: () => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  discard: (clientId: string) => Promise<void>;
  reset: () => Promise<void>;
  dispose: () => void;
};

export type ChatStoreDependencies = {
  transport: ChatTransport;
  conditions: NetworkConditions;
  store: KeyValueStore;
};

type PersistedTail = {
  messages: ConfirmedMessage[];
  lastSeenSeq: number;
};

const INITIAL_STATE: ChatState = {
  confirmed: [],
  pending: [],
  thread: [],
  oldestLoadedSeq: null,
  hasMoreHistory: true,
  lastSeenSeq: 0,
  connection: 'online',
  loadingOlder: false,
  ready: false,
};

export function createChatStore(dependencies: ChatStoreDependencies) {
  const { transport, conditions, store } = dependencies;
  const outbox = new Outbox(store);

  let flushing = false;
  let flushWaiters: (() => void)[] = [];
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeNetwork: (() => void) | null = null;
  let wasOnline = conditions.isOnline;

  const chatStore = createStore<ChatState & ChatActions>((set, get) => {
    function syncThread(confirmed: ConfirmedMessage[], pending: PendingMessage[]) {
      return buildThread(confirmed, pending);
    }

    function applyPending(pending: PendingMessage[]) {
      set({ pending, thread: syncThread(get().confirmed, pending) });
    }

    async function persistTail(): Promise<void> {
      const { confirmed, lastSeenSeq } = get();
      const tail: PersistedTail = {
        messages: confirmed.slice(-PERSISTED_TAIL_SIZE),
        lastSeenSeq,
      };
      await store.write(CLIENT_KEYS.confirmedTail, tail);
    }

    async function integrate(incoming: ConfirmedMessage[]): Promise<void> {
      if (incoming.length === 0) {
        return;
      }

      const confirmed = mergeConfirmed(get().confirmed, incoming);
      const stillPending = dropConfirmedFromOutbox(outbox.list(), incoming);
      const settled = outbox
        .list()
        .filter((entry) => !stillPending.includes(entry))
        .map((entry) => entry.clientId);

      for (const clientId of settled) {
        await outbox.remove(clientId);
      }

      set({
        confirmed,
        pending: outbox.list(),
        thread: syncThread(confirmed, outbox.list()),
        lastSeenSeq: highestSeq(incoming, get().lastSeenSeq),
        oldestLoadedSeq: confirmed.length > 0 ? confirmed[0].seq : get().oldestLoadedSeq,
      });

      await persistTail();
    }

    function scheduleRetry(attempt: number): void {
      if (retryTimer !== null) {
        return;
      }
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void get().flush();
      }, backoffDelay(attempt));
    }

    function hasUntriedEntry(): boolean {
      return outbox.list().some((entry) => entry.status === 'queued' && entry.failure === null);
    }

    async function flushQueue(): Promise<void> {
      if (flushing) {
        await new Promise<void>((resolve) => flushWaiters.push(resolve));
        if (conditions.isOnline && hasUntriedEntry()) {
          await flushQueue();
        }
        return;
      }
      flushing = true;

      try {
        for (;;) {
          const next = outbox.list().find((entry) => entry.status === 'queued');
          if (!next || !conditions.isOnline) {
            break;
          }

          await outbox.markSending(next.clientId);
          applyPending(outbox.list());

          try {
            const message = await transport.send({
              clientId: next.clientId,
              text: next.text,
            });
            await outbox.remove(next.clientId);
            await integrate([message]);
          } catch (error) {
            const failure = describeFailure(error);

            if (!failure.recoverable) {
              await outbox.markFailed(next.clientId, failure);
              applyPending(outbox.list());
              continue;
            }

            await outbox.markQueued(next.clientId, failure);
            applyPending(outbox.list());

            if (isTransportError(error) && error.code === 'offline') {
              set({ connection: 'offline' });
              break;
            }

            scheduleRetry(next.attempts + 1);
            break;
          }
        }
      } finally {
        flushing = false;
        const waiters = flushWaiters;
        flushWaiters = [];
        waiters.forEach((resolve) => resolve());
      }
    }

    return {
      ...INITIAL_STATE,

      async initialize() {
        const tail = await store.read<PersistedTail>(CLIENT_KEYS.confirmedTail);
        const pending = await outbox.load();

        const confirmed = tail?.messages ?? [];
        set({
          confirmed,
          pending,
          thread: syncThread(confirmed, pending),
          lastSeenSeq: tail?.lastSeenSeq ?? 0,
          oldestLoadedSeq: confirmed.length > 0 ? confirmed[0].seq : null,
          connection: conditions.isOnline ? 'online' : 'offline',
          ready: true,
        });

        unsubscribeNetwork?.();
        wasOnline = conditions.isOnline;
        unsubscribeNetwork = conditions.changes.subscribe((snapshot) => {
          if (snapshot.online === wasOnline) {
            return;
          }
          wasOnline = snapshot.online;

          if (!snapshot.online) {
            set({ connection: 'offline' });
            return;
          }

          set({ connection: 'syncing' });
          void get()
            .pull()
            .then(() => get().flush());
        });

        if (conditions.isOnline) {
          await get().pull();
          await get().flush();
        }
      },

      async send(text) {
        const trimmed = text.trim();
        if (trimmed.length === 0) {
          return;
        }
        await outbox.enqueue(trimmed);
        applyPending(outbox.list());
        await flushQueue();
      },

      async flush() {
        await flushQueue();
      },

      async pull() {
        const { lastSeenSeq } = get();

        try {
          if (lastSeenSeq === 0) {
            const page = await transport.fetchPage(null, HISTORY_PAGE_SIZE);
            set({ hasMoreHistory: page.hasMore });
            await integrate(page.messages);
          } else {
            const incoming = await transport.pullSince(lastSeenSeq);
            await integrate(incoming);
          }
          set({ connection: 'online' });
        } catch (error) {
          if (isTransportError(error) && error.code === 'offline') {
            set({ connection: 'offline' });
            return;
          }
          throw error;
        }
      },

      async loadOlder() {
        const { loadingOlder, hasMoreHistory, oldestLoadedSeq, confirmed } = get();
        if (loadingOlder || !hasMoreHistory) {
          return;
        }

        set({ loadingOlder: true });
        try {
          const page = await transport.fetchPage(oldestLoadedSeq, HISTORY_PAGE_SIZE);
          const merged = mergeConfirmed(confirmed, page.messages);
          set({
            confirmed: merged,
            thread: syncThread(merged, outbox.list()),
            oldestLoadedSeq: merged.length > 0 ? merged[0].seq : oldestLoadedSeq,
            hasMoreHistory: page.hasMore,
          });
        } catch (error) {
          if (!isTransportError(error) || error.code !== 'offline') {
            throw error;
          }
          set({ connection: 'offline' });
        } finally {
          set({ loadingOlder: false });
        }
      },

      async retry(clientId) {
        await outbox.retry(clientId);
        applyPending(outbox.list());
        await flushQueue();
      },

      async discard(clientId) {
        await outbox.remove(clientId);
        applyPending(outbox.list());
      },

      async reset() {
        if (retryTimer !== null) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        await outbox.clear();
        await store.remove(CLIENT_KEYS.confirmedTail);
        await store.remove(CLIENT_KEYS.lastSeenSeq);
        set({ ...INITIAL_STATE });
      },

      dispose() {
        if (retryTimer !== null) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        unsubscribeNetwork?.();
        unsubscribeNetwork = null;
      },
    };
  });

  return chatStore;
}

export type ChatStore = ReturnType<typeof createChatStore>;
