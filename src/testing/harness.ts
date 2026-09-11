import { ChatTransport } from '../services/chat/chatTransport';
import { MemoryStore } from '../storage/memoryStore';
import { MockBillingService } from '../services/billing/mockBillingService';
import { MockChatServer } from '../services/chat/mockChatServer';
import { MockEntitlementBackend } from '../services/billing/mockEntitlementBackend';
import { NetworkConditions } from '../services/chat/networkConditions';
import { createChatStore } from '../features/chat/chatStore';
import { createPaywallStore } from '../features/paywall/paywallStore';

export const HISTORY_SIZE = 20;

export type Harness = {
  clientBytes: MemoryStore;
  serverBytes: MemoryStore;
  billingBytes: MemoryStore;
  conditions: NetworkConditions;
  server: MockChatServer;
  entitlements: MockEntitlementBackend;
  billing: MockBillingService;
  chat: ReturnType<typeof createChatStore>;
  paywall: ReturnType<typeof createPaywallStore>;
};

export type HarnessOptions = {
  clientBytes?: MemoryStore;
  serverBytes?: MemoryStore;
  billingBytes?: MemoryStore;
  idempotency?: boolean;
  historySize?: number;
};

export function createHarness(options: HarnessOptions = {}): Harness {
  const clientBytes = options.clientBytes ?? new MemoryStore();
  const serverBytes = options.serverBytes ?? new MemoryStore();
  const billingBytes = options.billingBytes ?? new MemoryStore();

  const conditions = new NetworkConditions();
  conditions.update({ latencyMs: 0 });

  const server = new MockChatServer({
    store: serverBytes,
    historySize: options.historySize ?? HISTORY_SIZE,
    idempotency: options.idempotency ?? true,
  });

  const entitlements = new MockEntitlementBackend({
    store: serverBytes,
    confirmationDelayMs: null,
  });

  const billing = new MockBillingService({ store: billingBytes, latencyMs: 0 });
  const transport = new ChatTransport({ server, conditions, entitlements });

  return {
    clientBytes,
    serverBytes,
    billingBytes,
    conditions,
    server,
    entitlements,
    billing,
    chat: createChatStore({ transport, conditions, store: clientBytes }),
    paywall: createPaywallStore({ billing, entitlements }),
  };
}

export function restart(harness: Harness): Harness {
  harness.chat.getState().dispose();
  harness.paywall.getState().dispose();

  return createHarness({
    clientBytes: new MemoryStore(harness.clientBytes.snapshot()),
    serverBytes: new MemoryStore(harness.serverBytes.snapshot()),
    billingBytes: new MemoryStore(harness.billingBytes.snapshot()),
  });
}

export async function grantAccess(harness: Harness): Promise<void> {
  await harness.entitlements.submitReceipt({
    transactionId: 'txn_test_access',
    productId: 'fansuite.all_access.monthly',
    purchasedAt: Date.now(),
    signature: 'sig_test',
  });
  await harness.entitlements.confirmAllPending();
}

export function reloadClient(harness: Harness): Harness {
  harness.chat.getState().dispose();
  harness.paywall.getState().dispose();

  return createHarness({
    serverBytes: new MemoryStore(harness.serverBytes.snapshot()),
    billingBytes: new MemoryStore(harness.billingBytes.snapshot()),
  });
}

export function sentMessageTexts(harness: Harness): string[] {
  return harness.chat
    .getState()
    .confirmed.filter((message) => message.clientId !== null)
    .map((message) => message.text);
}

export async function serverMessageTexts(harness: Harness): Promise<string[]> {
  const messages = await harness.server.pullSince(HISTORY_SIZE);
  return messages.map((message) => message.text);
}
