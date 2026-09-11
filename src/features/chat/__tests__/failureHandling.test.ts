import { createHarness, sentMessageTexts, grantAccess } from '../../../testing/harness';

describe('failed sends', () => {
  it('keeps the text and offers a retry for a recoverable server outage', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ injectedFailure: 'server-unavailable' });
    await harness.chat.getState().send('this one hits an outage');

    const [entry] = harness.chat.getState().pending;
    expect(entry.text).toBe('this one hits an outage');
    expect(entry.status).toBe('queued');
    expect(entry.failure?.recoverable).toBe(true);
    expect(entry.failure?.action).toBe('retry');

    await harness.chat.getState().retry(entry.clientId);

    expect(harness.chat.getState().pending).toHaveLength(0);
    expect(sentMessageTexts(harness)).toEqual(['this one hits an outage']);

    harness.chat.getState().dispose();
  });

  it('marks a rejected message as failed and points at a different action', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ injectedFailure: 'message-rejected' });
    await harness.chat.getState().send('rejected text');

    const [entry] = harness.chat.getState().pending;
    expect(entry.status).toBe('failed');
    expect(entry.text).toBe('rejected text');
    expect(entry.failure?.recoverable).toBe(false);
    expect(entry.failure?.action).toBe('edit');

    harness.chat.getState().dispose();
  });

  it('does not block later messages behind one fatal failure', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ online: false });
    await harness.chat.getState().send('rejected text');
    await harness.chat.getState().send('good text');

    harness.conditions.update({ online: true, injectedFailure: 'message-rejected' });
    await harness.chat.getState().flush();

    expect(sentMessageTexts(harness)).toEqual(['good text']);
    expect(harness.chat.getState().pending.map((entry) => entry.status)).toEqual(['failed']);

    harness.chat.getState().dispose();
  });

  it('points a fan without access at the paywall instead of retrying forever', async () => {
    const harness = createHarness();
    await harness.chat.getState().initialize();

    await harness.chat.getState().send('no subscription yet');

    const [entry] = harness.chat.getState().pending;
    expect(entry.status).toBe('failed');
    expect(entry.failure?.action).toBe('open-paywall');

    harness.chat.getState().dispose();
  });
});
