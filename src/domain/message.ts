export type MessageAuthor = 'fan' | 'creator';

export type MessageKind = 'text' | 'media' | 'gift';

export type ConfirmedMessage = {
  id: string;
  clientId: string | null;
  seq: number;
  author: MessageAuthor;
  kind: MessageKind;
  text: string;
  mediaUrl?: string;
  amountCents?: number;
  createdAt: number;
};

export type PendingStatus = 'queued' | 'sending' | 'failed';

export type PendingMessage = {
  clientId: string;
  text: string;
  createdAt: number;
  status: PendingStatus;
  attempts: number;
  failure: PendingFailure | null;
};

export type PendingFailure = {
  code: string;
  message: string;
  recoverable: boolean;
  action: FailureAction;
};

export type FailureAction = 'retry' | 'open-paywall' | 'edit' | 'none';

export type ThreadItem =
  | { key: string; type: 'confirmed'; message: ConfirmedMessage }
  | { key: string; type: 'pending'; message: PendingMessage }
  | { key: string; type: 'day-separator'; label: string };

export function isOwnMessage(message: ConfirmedMessage): boolean {
  return message.author === 'fan';
}
