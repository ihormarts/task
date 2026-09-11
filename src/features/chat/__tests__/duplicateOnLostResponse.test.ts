import {
  createHarness,
  grantAccess,
  reloadClient,
  sentMessageTexts,
  serverMessageTexts,
} from '../../../testing/harness';

async function sendWithLostResponseThenRetry(idempotency: boolean) {
  const harness = createHarness({ idempotency });
  await grantAccess(harness);
  await harness.chat.getState().initialize();

  harness.conditions.update({ dropResponses: true });
  await harness.chat.getState().send('did this go through');

  harness.conditions.update({ dropResponses: false });
  await harness.chat.getState().flush();

  return harness;
}

describe('a send whose response is lost', () => {
  it('is stored twice when the server does not deduplicate on the client id', async () => {
    const harness = await sendWithLostResponseThenRetry(false);

    expect(await serverMessageTexts(harness)).toEqual([
      'did this go through',
      'did this go through',
    ]);

    const reopened = reloadClient(harness);
    await reopened.chat.getState().initialize();

    expect(sentMessageTexts(reopened)).toEqual([
      'did this go through',
      'did this go through',
    ]);

    reopened.chat.getState().dispose();
  });

  it('is stored once when the server deduplicates on the client id', async () => {
    const harness = await sendWithLostResponseThenRetry(true);

    expect(await serverMessageTexts(harness)).toEqual(['did this go through']);
    expect(sentMessageTexts(harness)).toEqual(['did this go through']);
    expect(harness.chat.getState().pending).toHaveLength(0);

    const reopened = reloadClient(harness);
    await reopened.chat.getState().initialize();

    expect(sentMessageTexts(reopened)).toEqual(['did this go through']);

    reopened.chat.getState().dispose();
  });

  it('does not add a second copy when recovery happens through a pull instead of a retry', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ dropResponses: true });
    await harness.chat.getState().send('recovered by pull');

    harness.conditions.update({ dropResponses: false });
    await harness.chat.getState().pull();

    expect(sentMessageTexts(harness)).toEqual(['recovered by pull']);
    expect(harness.chat.getState().pending).toHaveLength(0);

    await harness.chat.getState().flush();

    expect(await serverMessageTexts(harness)).toEqual(['recovered by pull']);
    expect(sentMessageTexts(harness)).toEqual(['recovered by pull']);

    harness.chat.getState().dispose();
  });
});
