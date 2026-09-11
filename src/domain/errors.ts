import type { FailureAction } from './message';

export type TransportErrorCode =
  | 'offline'
  | 'timeout'
  | 'server-unavailable'
  | 'response-lost'
  | 'entitlement-required'
  | 'message-rejected';

const RECOVERABLE: Record<TransportErrorCode, boolean> = {
  offline: true,
  timeout: true,
  'server-unavailable': true,
  'response-lost': true,
  'entitlement-required': false,
  'message-rejected': false,
};

const ACTIONS: Record<TransportErrorCode, FailureAction> = {
  offline: 'retry',
  timeout: 'retry',
  'server-unavailable': 'retry',
  'response-lost': 'retry',
  'entitlement-required': 'open-paywall',
  'message-rejected': 'edit',
};

const MESSAGES: Record<TransportErrorCode, string> = {
  offline: 'No connection. This will send when you are back online.',
  timeout: 'The server took too long to answer.',
  'server-unavailable': 'The server is unavailable right now.',
  'response-lost': 'The connection dropped before we heard back.',
  'entitlement-required': 'A subscription is required to message this creator.',
  'message-rejected': 'This message was rejected. Edit it and try again.',
};

export class TransportError extends Error {
  readonly code: TransportErrorCode;

  constructor(code: TransportErrorCode) {
    super(MESSAGES[code]);
    this.name = 'TransportError';
    this.code = code;
  }

  get recoverable(): boolean {
    return RECOVERABLE[this.code];
  }

  get action(): FailureAction {
    return ACTIONS[this.code];
  }
}

export function isTransportError(error: unknown): error is TransportError {
  return error instanceof TransportError;
}

export function describeFailure(error: unknown) {
  if (isTransportError(error)) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      action: error.action,
    };
  }
  return {
    code: 'unknown',
    message: 'Something went wrong while sending.',
    recoverable: true,
    action: 'retry' as const,
  };
}
