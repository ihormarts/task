import { Emitter } from '../../lib/emitter';
import { NO_ENTITLEMENT, isEntitlementActive } from '../../domain/billing';
import type { Entitlement, PurchaseReceipt } from '../../domain/billing';
import type { KeyValueStore } from '../../storage/types';
import { SERVER_KEYS } from '../../storage/storageKeys';

const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type ReceiptSubmission = {
  transactionId: string;
  productId: string;
  receivedAt: number;
};

export type SubmitResult = {
  entitlement: Entitlement;
  alreadyKnown: boolean;
};

export type MockEntitlementBackendOptions = {
  store: KeyValueStore;
  confirmationDelayMs?: number;
};

export class MockEntitlementBackend {
  private readonly store: KeyValueStore;

  private entitlement: Entitlement = NO_ENTITLEMENT;

  private pending = new Map<string, ReceiptSubmission>();

  private loaded = false;

  confirmationDelayMs: number;

  readonly changes = new Emitter<Entitlement>();

  constructor(options: MockEntitlementBackendOptions) {
    this.store = options.store;
    this.confirmationDelayMs = options.confirmationDelayMs ?? 4000;
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const entitlement = await this.store.read<Entitlement>(SERVER_KEYS.entitlement);
    const pending = await this.store.read<ReceiptSubmission[]>(SERVER_KEYS.pendingReceipts);
    this.entitlement = entitlement ?? NO_ENTITLEMENT;
    this.pending = new Map((pending ?? []).map((item) => [item.transactionId, item]));
    this.loaded = true;
  }

  async getEntitlement(): Promise<Entitlement> {
    await this.load();
    if (this.entitlement.status === 'active' && !isEntitlementActive(this.entitlement)) {
      await this.setEntitlement({ ...this.entitlement, status: 'expired' });
    }
    return this.entitlement;
  }

  async hasActiveAccess(): Promise<boolean> {
    return isEntitlementActive(await this.getEntitlement());
  }

  async submitReceipt(receipt: PurchaseReceipt): Promise<SubmitResult> {
    await this.load();

    if (this.entitlement.transactionId === receipt.transactionId) {
      return { entitlement: this.entitlement, alreadyKnown: true };
    }

    if (this.pending.has(receipt.transactionId)) {
      return { entitlement: this.entitlement, alreadyKnown: true };
    }

    this.pending.set(receipt.transactionId, {
      transactionId: receipt.transactionId,
      productId: receipt.productId,
      receivedAt: Date.now(),
    });
    await this.persist();

    if (!isEntitlementActive(this.entitlement)) {
      await this.setEntitlement({
        status: 'pending',
        productId: receipt.productId,
        transactionId: receipt.transactionId,
        confirmedAt: null,
        expiresAt: null,
      });
    }

    return { entitlement: this.entitlement, alreadyKnown: false };
  }

  async confirmPending(transactionId: string): Promise<Entitlement> {
    await this.load();

    const submission = this.pending.get(transactionId);
    if (!submission) {
      return this.entitlement;
    }

    this.pending.delete(transactionId);
    const now = Date.now();
    await this.setEntitlement({
      status: 'active',
      productId: submission.productId,
      transactionId: submission.transactionId,
      confirmedAt: now,
      expiresAt: now + SUBSCRIPTION_PERIOD_MS,
    });

    return this.entitlement;
  }

  async confirmAllPending(): Promise<Entitlement> {
    await this.load();
    const transactionIds = [...this.pending.keys()];
    for (const transactionId of transactionIds) {
      await this.confirmPending(transactionId);
    }
    return this.entitlement;
  }

  async expireEntitlement(): Promise<Entitlement> {
    await this.load();
    if (this.entitlement.status === 'active') {
      await this.setEntitlement({ ...this.entitlement, status: 'expired', expiresAt: Date.now() });
    }
    return this.entitlement;
  }

  async reset(): Promise<void> {
    this.pending.clear();
    this.loaded = true;
    await this.setEntitlement(NO_ENTITLEMENT);
  }

  private async setEntitlement(next: Entitlement): Promise<void> {
    this.entitlement = next;
    await this.persist();
    this.changes.emit(next);
  }

  private async persist(): Promise<void> {
    await this.store.write(SERVER_KEYS.entitlement, this.entitlement);
    await this.store.write(SERVER_KEYS.pendingReceipts, [...this.pending.values()]);
  }
}
