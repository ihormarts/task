import { AsyncStorageStore } from '../storage/asyncStorageStore';
import { ChatTransport } from '../services/chat/chatTransport';
import { MockBillingService } from '../services/billing/mockBillingService';
import { MockChatServer } from '../services/chat/mockChatServer';
import { MockEntitlementBackend } from '../services/billing/mockEntitlementBackend';
import { NetworkConditions } from '../services/chat/networkConditions';
import { STORAGE_NAMESPACES } from '../storage/storageKeys';
import { createChatStore } from '../features/chat/chatStore';
import { createPaywallStore } from '../features/paywall/paywallStore';

const clientStore = new AsyncStorageStore(STORAGE_NAMESPACES.client);
const serverStore = new AsyncStorageStore(STORAGE_NAMESPACES.server);
const billingStore = new AsyncStorageStore(STORAGE_NAMESPACES.billing);

export const conditions = new NetworkConditions();
export const chatServer = new MockChatServer({ store: serverStore });
export const entitlements = new MockEntitlementBackend({ store: serverStore });
export const billing = new MockBillingService({ store: billingStore });

const transport = new ChatTransport({ server: chatServer, conditions, entitlements });

export const chatStore = createChatStore({ transport, conditions, store: clientStore });
export const paywallStore = createPaywallStore({ billing, entitlements });

export async function bootstrap(): Promise<void> {
  await chatServer.load();
  await entitlements.load();
  await billing.load();
  await paywallStore.getState().initialize();
  await chatStore.getState().initialize();
}

export async function resetEverything(): Promise<void> {
  await chatStore.getState().reset();
  await paywallStore.getState().reset();
  await chatServer.reset();
  await clientStore.clear();
  conditions.reset();
  await bootstrap();
}
