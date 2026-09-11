import { buildThread, dropConfirmedFromOutbox, mergeConfirmed } from '../threadMerge';
import { createHarness, grantAccess } from '../../../testing/harness';
import type { ConfirmedMessage, PendingMessage } from '../../../domain/message';

function confirmed(seq: number, clientId: string | null = null): ConfirmedMessage {
  return {
    id: `srv_${seq}`,
    clientId,
    seq,
    author: 'fan',
    kind: 'text',
    text: `message ${seq}`,
    createdAt: 1_700_000_000_000 + seq * 1000,
  };
}

function pending(clientId: string, createdAt: number): PendingMessage {
  return {
    clientId,
    text: clientId,
    createdAt,
    status: 'queued',
    attempts: 0,
    failure: null,
  };
}

describe('thread ordering', () => {
  it('sorts confirmed messages by the sequence the server assigned', () => {
    const merged = mergeConfirmed([confirmed(3), confirmed(1)], [confirmed(2)]);
    expect(merged.map((message) => message.seq)).toEqual([1, 2, 3]);
  });

  it('removes a queued message once a confirmation carries its client id', () => {
    const remaining = dropConfirmedFromOutbox(
      [pending('abc', 1), pending('def', 2)],
      [confirmed(7, 'abc')],
    );

    expect(remaining.map((entry) => entry.clientId)).toEqual(['def']);
  });

  it('does not reorder or duplicate when the same page is merged repeatedly', () => {
    const page = [confirmed(1), confirmed(2), confirmed(3)];
    const once = mergeConfirmed([], page);
    const twice = mergeConfirmed(once, page);
    const thrice = mergeConfirmed(twice, page);

    expect(thrice.map((message) => message.seq)).toEqual([1, 2, 3]);
    expect(thrice).toHaveLength(3);
  });

  it('keeps queued messages in local order after the confirmed section', () => {
    const items = buildThread(
      [confirmed(1), confirmed(2)],
      [pending('b', 1_700_000_100_000), pending('a', 1_700_000_050_000)],
    );

    const keys = items.filter((item) => item.type !== 'day-separator').map((item) => item.key);
    expect(keys).toEqual(['msg-srv_1', 'msg-srv_2', 'pending-a', 'pending-b']);
  });

  it('moves a message from the queued tail into the confirmed section exactly once', async () => {
    const harness = createHarness();
    await grantAccess(harness);
    await harness.chat.getState().initialize();

    harness.conditions.update({ online: false });
    await harness.chat.getState().send('settling');

    const queuedKeys = harness.chat.getState().thread.map((item) => item.key);
    expect(queuedKeys.filter((key) => key.startsWith('pending-'))).toHaveLength(1);

    harness.conditions.update({ online: true });
    await harness.chat.getState().flush();
    await harness.chat.getState().pull();
    await harness.chat.getState().pull();

    const settledKeys = harness.chat.getState().thread.map((item) => item.key);
    expect(settledKeys.filter((key) => key.startsWith('pending-'))).toHaveLength(0);
    expect(
      harness.chat.getState().confirmed.filter((message) => message.text === 'settling'),
    ).toHaveLength(1);

    harness.chat.getState().dispose();
  });
});
