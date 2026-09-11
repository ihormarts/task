import { isEntitlementActive } from '../../../domain/billing';
import { createHarness, restart } from '../../chat/__tests__/testHarness';

const PRODUCT_ID = 'fansuite.all_access.monthly';

describe('paid access', () => {
  it('does not grant access until the backend confirms the receipt', async () => {
    const harness = createHarness();
    await harness.paywall.getState().initialize();

    await harness.paywall.getState().purchase(PRODUCT_ID);

    expect(harness.paywall.getState().phase).toBe('awaiting-confirmation');
    expect(harness.paywall.getState().entitlement.status).toBe('pending');
    expect(isEntitlementActive(harness.paywall.getState().entitlement)).toBe(false);

    await harness.entitlements.confirmAllPending();

    expect(harness.paywall.getState().entitlement.status).toBe('active');
    expect(isEntitlementActive(harness.paywall.getState().entitlement)).toBe(true);
    expect(harness.paywall.getState().phase).toBe('idle');

    harness.paywall.getState().dispose();
  });

  it('ignores a second tap while a purchase is already running', async () => {
    const harness = createHarness();
    harness.billing.latencyMs = 10;
    await harness.paywall.getState().initialize();

    await Promise.all([
      harness.paywall.getState().purchase(PRODUCT_ID),
      harness.paywall.getState().purchase(PRODUCT_ID),
      harness.paywall.getState().purchase(PRODUCT_ID),
    ]);

    await harness.entitlements.confirmAllPending();

    const receipts = await harness.billing.restore();
    expect(receipts).toHaveLength(1);
    expect(harness.paywall.getState().entitlement.transactionId).toBe(receipts[0].transactionId);

    harness.paywall.getState().dispose();
  });

  it('reports a cancellation without touching access', async () => {
    const harness = createHarness();
    await harness.paywall.getState().initialize();

    harness.billing.behaviour = 'cancel';
    await harness.paywall.getState().purchase(PRODUCT_ID);

    expect(harness.paywall.getState().phase).toBe('cancelled');
    expect(harness.paywall.getState().entitlement.status).toBe('none');

    harness.paywall.getState().dispose();
  });

  it('keeps valid access when an unrelated purchase attempt fails', async () => {
    const harness = createHarness();
    await harness.paywall.getState().initialize();

    await harness.paywall.getState().purchase(PRODUCT_ID);
    await harness.entitlements.confirmAllPending();
    expect(isEntitlementActive(harness.paywall.getState().entitlement)).toBe(true);

    harness.billing.behaviour = 'fail';
    await harness.paywall.getState().purchase('fansuite.tip.pack');

    expect(harness.paywall.getState().phase).toBe('failed');
    expect(harness.paywall.getState().notice).toBeTruthy();
    expect(isEntitlementActive(harness.paywall.getState().entitlement)).toBe(true);

    harness.paywall.getState().dispose();
  });

  it('restores an existing purchase without creating a second entitlement', async () => {
    let harness = createHarness();
    await harness.paywall.getState().initialize();
    await harness.paywall.getState().purchase(PRODUCT_ID);
    await harness.entitlements.confirmAllPending();

    const originalTransactionId = harness.paywall.getState().entitlement.transactionId;
    harness.paywall.getState().dispose();

    harness = restart(harness);
    await harness.paywall.getState().initialize();
    await harness.paywall.getState().restore();
    await harness.paywall.getState().restore();

    expect(harness.paywall.getState().entitlement.transactionId).toBe(originalTransactionId);
    expect(await harness.billing.restore()).toHaveLength(1);

    harness.paywall.getState().dispose();
  });

  it('unlocks sending once access is confirmed', async () => {
    const harness = createHarness();
    await harness.paywall.getState().initialize();
    await harness.chat.getState().initialize();

    await harness.chat.getState().send('before access');
    expect(harness.chat.getState().pending[0].failure?.action).toBe('open-paywall');

    await harness.paywall.getState().purchase(PRODUCT_ID);
    await harness.entitlements.confirmAllPending();

    await harness.chat.getState().retry(harness.chat.getState().pending[0].clientId);

    expect(harness.chat.getState().pending).toHaveLength(0);
    expect(
      harness.chat.getState().confirmed.filter((message) => message.text === 'before access'),
    ).toHaveLength(1);

    harness.chat.getState().dispose();
    harness.paywall.getState().dispose();
  });
});
