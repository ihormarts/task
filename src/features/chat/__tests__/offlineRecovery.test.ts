import { createHarness, sentMessageTexts, grantAccess, restart } from '../../../testing/harness';

describe('recovery after going offline', () => {
  it('keeps three offline sends waiting, survives a restart and delivers them once', async () => {
    let harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ online: false });

    await harness.chat.getState().send('first');
    await harness.chat.getState().send('second');
    await harness.chat.getState().send('third');

    expect(harness.chat.getState().pending.map((entry) => entry.text)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(harness.chat.getState().pending.every((entry) => entry.status === 'queued')).toBe(true);

    const clientIdsBeforeRestart = harness.chat.getState().pending.map((entry) => entry.clientId);

    harness = restart(harness);
    harness.conditions.update({ online: false });
    await harness.chat.getState().initialize();

    expect(harness.chat.getState().pending.map((entry) => entry.text)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(harness.chat.getState().pending.map((entry) => entry.clientId)).toEqual(
      clientIdsBeforeRestart,
    );

    await harness.server.appendIncoming([
      'while you were away one',
      'while you were away two',
      'while you were away three',
      'while you were away four',
    ]);

    harness.conditions.update({ online: true });
    await harness.chat.getState().pull();
    await harness.chat.getState().flush();

    expect(harness.chat.getState().pending).toHaveLength(0);
    expect(sentMessageTexts(harness)).toEqual(['first', 'second', 'third']);

    const creatorTexts = harness.chat
      .getState()
      .confirmed.filter((message) => message.author === 'creator')
      .map((message) => message.text);

    expect(creatorTexts).toEqual(
      expect.arrayContaining([
        'while you were away one',
        'while you were away two',
        'while you were away three',
        'while you were away four',
      ]),
    );

    harness.chat.getState().dispose();
  });

  it('retries a send that was left mid-flight by a force quit without duplicating it', async () => {
    let harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ dropResponses: true });
    await harness.chat.getState().send('mid flight');

    harness = restart(harness);
    await harness.chat.getState().initialize();

    expect(sentMessageTexts(harness)).toEqual(['mid flight']);
    expect(harness.chat.getState().pending).toHaveLength(0);

    harness.chat.getState().dispose();
  });
});
