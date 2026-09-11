import { createTransactionId } from '../../lib/ids';
import { delay } from '../../lib/delay';
import { BILLING_KEYS } from '../../storage/storageKeys';
import type { BillingErrorCode, Product, PurchaseOutcome, PurchaseReceipt } from '../../domain/billing';
import type { KeyValueStore } from '../../storage/types';

export const ALL_ACCESS_PRODUCT: Product = {
  id: 'fansuite.all_access.monthly',
  title: 'All Access',
  description: 'Direct messages, full archive and early drops from Ethan Shoots.',
  priceLabel: '$9.99',
  periodLabel: 'per month',
  benefits: [
    'Unlimited direct messages',
    'Full media archive',
    'Posts 24 hours early',
  ],
};

export type BillingBehaviour = 'succeed' | 'cancel' | 'fail';

export type MockBillingServiceOptions = {
  store: KeyValueStore;
  latencyMs?: number;
};

export class MockBillingService {
  private readonly store: KeyValueStore;

  private owned = new Map<string, PurchaseReceipt>();

  private loaded = false;

  latencyMs: number;

  behaviour: BillingBehaviour = 'succeed';

  failureCode: BillingErrorCode = 'payment-declined';

  constructor(options: MockBillingServiceOptions) {
    this.store = options.store;
    this.latencyMs = options.latencyMs ?? 900;
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const stored = await this.store.read<PurchaseReceipt[]>(BILLING_KEYS.ownedTransactions);
    this.owned = new Map((stored ?? []).map((receipt) => [receipt.transactionId, receipt]));
    this.loaded = true;
  }

  listProducts(): Product[] {
    return [ALL_ACCESS_PRODUCT];
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    await this.load();
    await delay(this.latencyMs);

    if (this.behaviour === 'cancel') {
      return { status: 'cancelled' };
    }

    if (this.behaviour === 'fail') {
      return {
        status: 'failed',
        code: this.failureCode,
        message: FAILURE_MESSAGES[this.failureCode],
      };
    }

    const existing = [...this.owned.values()].find((receipt) => receipt.productId === productId);
    if (existing) {
      return { status: 'purchased', receipt: existing };
    }

    const receipt: PurchaseReceipt = {
      transactionId: createTransactionId(),
      productId,
      purchasedAt: Date.now(),
      signature: `sig_${productId}`,
    };

    this.owned.set(receipt.transactionId, receipt);
    await this.persist();

    return { status: 'purchased', receipt };
  }

  async restore(): Promise<PurchaseReceipt[]> {
    await this.load();
    await delay(this.latencyMs);
    return [...this.owned.values()];
  }

  async reset(): Promise<void> {
    this.owned.clear();
    this.loaded = true;
    this.behaviour = 'succeed';
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.store.write(BILLING_KEYS.ownedTransactions, [...this.owned.values()]);
  }
}

const FAILURE_MESSAGES: Record<BillingErrorCode, string> = {
  'billing-unavailable': 'The store is not available on this device right now.',
  'payment-declined': 'Your payment method was declined.',
  'already-owned': 'This subscription is already owned by another account.',
  network: 'The store could not be reached.',
};
