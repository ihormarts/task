import { createRandom, hashSeed, pick } from '../../lib/prng';
import type { ConfirmedMessage, MessageAuthor } from '../../domain/message';

const OPENERS = [
  'Just wrapped the stream',
  'New set list is up',
  'Thanks for the gift',
  'Backstage photos coming',
  'That clip blew up',
  'Rehearsal ran long',
  'Answering questions now',
  'Merch drop is live',
  'Working on the next edit',
  'Good morning',
];

const BODIES = [
  'let me know what you think',
  'the lighting rig finally behaved',
  'we hit a new record tonight',
  'I read every single reply',
  'the mix needs one more pass',
  'more of this next week',
  'tell me which take you prefer',
  'this one took three attempts',
  'the crowd was unreal',
  'saving the rest for the members',
];

const HISTORY_SEED = 'fansuite-history-v1';
const HISTORY_START_AT = Date.UTC(2026, 0, 1, 9, 0, 0);
const HISTORY_STEP_MS = 47_000;

export function generateHistoryMessage(seq: number): ConfirmedMessage {
  const random = createRandom(hashSeed(`${HISTORY_SEED}:${seq}`));
  const author: MessageAuthor = random() < 0.55 ? 'creator' : 'fan';
  const text = `${pick(random, OPENERS)}, ${pick(random, BODIES)}.`;

  return {
    id: `srv_${seq}`,
    clientId: null,
    seq,
    author,
    kind: 'text',
    text,
    createdAt: HISTORY_START_AT + seq * HISTORY_STEP_MS,
  };
}

export function generateHistoryRange(fromSeq: number, toSeq: number): ConfirmedMessage[] {
  const messages: ConfirmedMessage[] = [];
  for (let seq = fromSeq; seq <= toSeq; seq += 1) {
    messages.push(generateHistoryMessage(seq));
  }
  return messages;
}

export function historyTimestampFor(seq: number): number {
  return HISTORY_START_AT + seq * HISTORY_STEP_MS;
}
