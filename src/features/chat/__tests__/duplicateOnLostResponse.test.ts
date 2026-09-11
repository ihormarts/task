import { createHarness, fanMessageTexts, grantAccess } from './testHarness';

describe('a send whose response is lost', () => {
  it('creates a duplicate when the server does not deduplicate on the client id', async () => {
    const harness = createHarness({ idempotency: false });
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ dropResponses: true });
    await harness.chat.getState().send('did this go through');

    harness.conditions.update({ dropResponses: false });
    await harness.chat.getState().flush();
    await harness.chat.getState().pull();

    expect(fanMessageTexts(harness)).toEqual([
      'did this go through',
      'did this go through',
    ]);

    harness.chat.getState().dispose();
  });

  it('leaves one copy in the thread when the server deduplicates on the client id', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ dropResponses: true });
    await harness.chat.getState().send('did this go through');

    expect(harness.chat.getState().pending).toHaveLength(1);

    harness.conditions.update({ dropResponses: false });
    await harness.chat.getState().flush();
    await harness.chat.getState().pull();

    expect(fanMessageTexts(harness)).toEqual(['did this go through']);
    expect(harness.chat.getState().pending).toHaveLength(0);

    harness.chat.getState().dispose();
  });

  it('does not add a second copy when recovery happens through a pull instead of a retry', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ dropResponses: true });
    await harness.chat.getState().send('recovered by pull');

    harness.conditions.update({ dropResponses: false });
    await harness.chat.getState().pull();

    expect(fanMessageTexts(harness)).toEqual(['recovered by pull']);
    expect(harness.chat.getState().pending).toHaveLength(0);

    await harness.chat.getState().flush();
    expect(fanMessageTexts(harness)).toEqual(['recovered by pull']);

    harness.chat.getState().dispose();
  });
});
