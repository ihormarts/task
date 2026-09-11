import { createStore } from 'zustand/vanilla';

import { NO_ENTITLEMENT, isEntitlementActive } from '../../domain/billing';
import type { Entitlement, Product } from '../../domain/billing';
import type { MockBillingService } from '../../services/billing/mockBillingService';
import type { MockEntitlementBackend } from '../../services/billing/mockEntitlementBackend';

export type PurchasePhase =
  | 'idle'
  | 'purchasing'
  | 'awaiting-confirmation'
  | 'restoring'
  | 'cancelled'
  | 'failed';

export type PaywallState = {
  products: Product[];
  entitlement: Entitlement;
  phase: PurchasePhase;
  notice: string | null;
  ready: boolean;
};

export type PaywallActions = {
  initialize: () => Promise<void>;
  purchase: (productId: string) => Promise<void>;
  restore: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  dismissNotice: () => void;
  reset: () => Promise<void>;
  dispose: () => void;
};

export type PaywallStoreDependencies = {
  billing: MockBillingService;
  entitlements: MockEntitlementBackend;
};

const INITIAL_STATE: PaywallState = {
  products: [],
  entitlement: NO_ENTITLEMENT,
  phase: 'idle',
  notice: null,
  ready: false,
};

export function createPaywallStore(dependencies: PaywallStoreDependencies) {
  const { billing, entitlements } = dependencies;

  let purchaseInFlight = false;
  let unsubscribeEntitlements: (() => void) | null = null;

  return createStore<PaywallState & PaywallActions>((set, get) => {
    async function submitAndReflect(transactionId: string, productId: string): Promise<void> {
      const { entitlement } = await entitlements.submitReceipt({
        transactionId,
        productId,
        purchasedAt: Date.now(),
        signature: `sig_${productId}`,
      });

      set({
        entitlement,
        phase: isEntitlementActive(entitlement) ? 'idle' : 'awaiting-confirmation',
      });
    }

    return {
      ...INITIAL_STATE,

      async initialize() {
        const entitlement = await entitlements.getEntitlement();
        set({
          products: billing.listProducts(),
          entitlement,
          ready: true,
        });

        unsubscribeEntitlements?.();
        unsubscribeEntitlements = entitlements.changes.subscribe((next) => {
          set({
            entitlement: next,
            phase: isEntitlementActive(next) ? 'idle' : get().phase,
          });
        });
      },

      async purchase(productId) {
        if (purchaseInFlight) {
          return;
        }
        purchaseInFlight = true;
        set({ phase: 'purchasing', notice: null });

        try {
          const outcome = await billing.purchase(productId);

          if (outcome.status === 'cancelled') {
            set({ phase: 'cancelled', notice: 'Purchase cancelled.' });
            return;
          }

          if (outcome.status === 'failed') {
            set({ phase: 'failed', notice: outcome.message });
            return;
          }

          await submitAndReflect(outcome.receipt.transactionId, outcome.receipt.productId);
        } finally {
          purchaseInFlight = false;
        }
      },

      async restore() {
        if (purchaseInFlight) {
          return;
        }
        purchaseInFlight = true;
        set({ phase: 'restoring', notice: null });

        try {
          const receipts = await billing.restore();

          if (receipts.length === 0) {
            set({ phase: 'idle', notice: 'No previous purchase found for this account.' });
            return;
          }

          for (const receipt of receipts) {
            await submitAndReflect(receipt.transactionId, receipt.productId);
          }

          if (!isEntitlementActive(get().entitlement)) {
            set({ notice: 'Purchase restored. Waiting for the server to confirm access.' });
          }
        } finally {
          purchaseInFlight = false;
        }
      },

      async refreshEntitlement() {
        const entitlement = await entitlements.getEntitlement();
        set({ entitlement });
      },

      dismissNotice() {
        set({ notice: null });
      },

      async reset() {
        await billing.reset();
        await entitlements.reset();
        purchaseInFlight = false;
        set({ ...INITIAL_STATE, products: billing.listProducts(), ready: true });
      },

      dispose() {
        unsubscribeEntitlements?.();
        unsubscribeEntitlements = null;
      },
    };
  });
}

export type PaywallStore = ReturnType<typeof createPaywallStore>;
