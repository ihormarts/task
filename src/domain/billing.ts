export type Product = {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  periodLabel: string;
  benefits: readonly string[];
};

export type PurchaseReceipt = {
  transactionId: string;
  productId: string;
  purchasedAt: number;
  signature: string;
};

export type PurchaseOutcome =
  | { status: 'purchased'; receipt: PurchaseReceipt }
  | { status: 'cancelled' }
  | { status: 'failed'; code: BillingErrorCode; message: string };

export type BillingErrorCode =
  | 'billing-unavailable'
  | 'payment-declined'
  | 'already-owned'
  | 'network';

export type EntitlementStatus = 'none' | 'pending' | 'active' | 'expired';

export type Entitlement = {
  status: EntitlementStatus;
  productId: string | null;
  transactionId: string | null;
  confirmedAt: number | null;
  expiresAt: number | null;
};

export const NO_ENTITLEMENT: Entitlement = {
  status: 'none',
  productId: null,
  transactionId: null,
  confirmedAt: null,
  expiresAt: null,
};

export function isEntitlementActive(entitlement: Entitlement, now = Date.now()): boolean {
  if (entitlement.status !== 'active') {
    return false;
  }
  return entitlement.expiresAt === null || entitlement.expiresAt > now;
}
