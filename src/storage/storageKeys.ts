export const STORAGE_NAMESPACES = {
  client: 'fansuite.client',
  server: 'fansuite.server',
  billing: 'fansuite.billing',
} as const;

export const CLIENT_KEYS = {
  outbox: 'outbox',
  confirmedTail: 'confirmed-tail',
  lastSeenSeq: 'last-seen-seq',
} as const;

export const SERVER_KEYS = {
  acceptedClientIds: 'accepted-client-ids',
  appendedMessages: 'appended-messages',
  entitlement: 'entitlement',
  pendingReceipts: 'pending-receipts',
} as const;

export const BILLING_KEYS = {
  ownedTransactions: 'owned-transactions',
} as const;
