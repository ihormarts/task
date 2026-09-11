import type { ConfirmedMessage, PendingMessage, ThreadItem } from '../../domain/message';

export function mergeConfirmed(
  existing: readonly ConfirmedMessage[],
  incoming: readonly ConfirmedMessage[],
): ConfirmedMessage[] {
  if (incoming.length === 0) {
    return existing as ConfirmedMessage[];
  }

  const bySeq = new Map<number, ConfirmedMessage>();
  existing.forEach((message) => bySeq.set(message.seq, message));
  incoming.forEach((message) => bySeq.set(message.seq, message));

  return [...bySeq.values()].sort((left, right) => left.seq - right.seq);
}

export function dropConfirmedFromOutbox(
  pending: readonly PendingMessage[],
  confirmed: readonly ConfirmedMessage[],
): PendingMessage[] {
  const confirmedClientIds = new Set(
    confirmed.map((message) => message.clientId).filter((id): id is string => id !== null),
  );
  return pending.filter((entry) => !confirmedClientIds.has(entry.clientId));
}

export function highestSeq(messages: readonly ConfirmedMessage[], fallback: number): number {
  return messages.reduce((max, message) => Math.max(max, message.seq), fallback);
}

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(timestamp: number, now: number): string {
  const today = dayKey(now);
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
  const key = dayKey(timestamp);

  if (key === today) {
    return 'Today';
  }
  if (key === yesterday) {
    return 'Yesterday';
  }
  return DAY_FORMATTER.format(new Date(timestamp));
}

export function buildThread(
  confirmed: readonly ConfirmedMessage[],
  pending: readonly PendingMessage[],
  now = Date.now(),
): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDayKey: string | null = null;

  confirmed.forEach((message) => {
    const key = dayKey(message.createdAt);
    if (key !== lastDayKey) {
      items.push({
        key: `day-${key}`,
        type: 'day-separator',
        label: dayLabel(message.createdAt, now),
      });
      lastDayKey = key;
    }
    items.push({ key: `msg-${message.id}`, type: 'confirmed', message });
  });

  [...pending]
    .sort((left, right) => left.createdAt - right.createdAt)
    .forEach((message) => {
      const key = dayKey(message.createdAt);
      if (key !== lastDayKey) {
        items.push({
          key: `day-${key}`,
          type: 'day-separator',
          label: dayLabel(message.createdAt, now),
        });
        lastDayKey = key;
      }
      items.push({ key: `pending-${message.clientId}`, type: 'pending', message });
    });

  return items;
}
