import { DEFAULT_HISTORY_SIZE, MockChatServer } from '../mockChatServer';
import { MemoryStore } from '../../../storage/memoryStore';
import { generateHistoryMessage } from '../historyGenerator';

describe('mock chat server', () => {
  it('generates the same history message for a sequence number every time', () => {
    const first = generateHistoryMessage(1234);
    const second = generateHistoryMessage(1234);

    expect(second).toEqual(first);
    expect(generateHistoryMessage(1235)).not.toEqual(first);
  });

  it('pages backwards through the full history without materialising it', async () => {
    const server = new MockChatServer({ store: new MemoryStore() });
    await server.load();

    expect(server.headSeq).toBe(DEFAULT_HISTORY_SIZE);

    const newest = await server.fetchPage({ beforeSeq: null, limit: 40 });
    expect(newest.messages).toHaveLength(40);
    expect(newest.messages[39].seq).toBe(DEFAULT_HISTORY_SIZE);
    expect(newest.hasMore).toBe(true);

    const older = await server.fetchPage({ beforeSeq: newest.oldestSeq, limit: 40 });
    expect(older.messages[39].seq).toBe(newest.messages[0].seq - 1);

    const oldest = await server.fetchPage({ beforeSeq: 2, limit: 40 });
    expect(oldest.messages.map((message) => message.seq)).toEqual([1]);
    expect(oldest.hasMore).toBe(false);
  });

  it('returns the existing message when the same client id is sent again', async () => {
    const server = new MockChatServer({ store: new MemoryStore(), historySize: 10 });

    const first = await server.accept({ clientId: 'c1', text: 'hello', author: 'fan' });
    const second = await server.accept({ clientId: 'c1', text: 'hello', author: 'fan' });

    expect(second.deduplicated).toBe(true);
    expect(second.message.id).toBe(first.message.id);
    expect(server.headSeq).toBe(11);
  });

  it('remembers accepted client ids across a restart', async () => {
    const bytes = new MemoryStore();
    const first = new MockChatServer({ store: bytes, historySize: 10 });
    const accepted = await first.accept({ clientId: 'c1', text: 'hello', author: 'fan' });

    const second = new MockChatServer({ store: new MemoryStore(bytes.snapshot()), historySize: 10 });
    const retried = await second.accept({ clientId: 'c1', text: 'hello', author: 'fan' });

    expect(retried.deduplicated).toBe(true);
    expect(retried.message.id).toBe(accepted.message.id);
  });

  it('creates a second message when deduplication is disabled', async () => {
    const server = new MockChatServer({
      store: new MemoryStore(),
      historySize: 10,
      idempotency: false,
    });

    const first = await server.accept({ clientId: 'c1', text: 'hello', author: 'fan' });
    const second = await server.accept({ clientId: 'c1', text: 'hello', author: 'fan' });

    expect(second.message.id).not.toBe(first.message.id);
  });

  it('only returns messages newer than the sequence the client already has', async () => {
    const server = new MockChatServer({ store: new MemoryStore(), historySize: 10 });
    await server.appendIncoming(['one', 'two']);

    const incoming = await server.pullSince(10);
    expect(incoming.map((message) => message.text)).toEqual(['one', 'two']);
    expect(await server.pullSince(12)).toEqual([]);
  });
});
