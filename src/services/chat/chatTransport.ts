import { TransportError } from '../../domain/errors';
import { delay } from '../../lib/delay';
import type { ConfirmedMessage } from '../../domain/message';
import type { MockChatServer, Page } from './mockChatServer';
import type { NetworkConditions } from './networkConditions';
import type { MockEntitlementBackend } from '../billing/mockEntitlementBackend';

export type SendRequest = {
  clientId: string;
  text: string;
};

export type ChatTransportOptions = {
  server: MockChatServer;
  conditions: NetworkConditions;
  entitlements: MockEntitlementBackend;
};

export class ChatTransport {
  private readonly server: MockChatServer;

  private readonly conditions: NetworkConditions;

  private readonly entitlements: MockEntitlementBackend;

  constructor(options: ChatTransportOptions) {
    this.server = options.server;
    this.conditions = options.conditions;
    this.entitlements = options.entitlements;
  }

  async send(request: SendRequest): Promise<ConfirmedMessage> {
    await this.simulateRequest();

    const injected = this.conditions.consumeInjectedFailure();
    if (injected !== null && injected !== 'response-lost') {
      throw new TransportError(injected);
    }

    if (!(await this.entitlements.hasActiveAccess())) {
      throw new TransportError('entitlement-required');
    }

    const result = await this.server.accept({
      clientId: request.clientId,
      text: request.text,
      author: 'fan',
    });

    if (this.conditions.current.dropResponses || injected === 'response-lost') {
      throw new TransportError('response-lost');
    }

    return result.message;
  }

  async fetchPage(beforeSeq: number | null, limit: number): Promise<Page> {
    await this.simulateRequest();
    return this.server.fetchPage({ beforeSeq, limit });
  }

  async pullSince(seq: number): Promise<ConfirmedMessage[]> {
    await this.simulateRequest();
    return this.server.pullSince(seq);
  }

  async headSeq(): Promise<number> {
    await this.simulateRequest();
    return this.server.headSeq;
  }

  private async simulateRequest(): Promise<void> {
    if (!this.conditions.isOnline) {
      throw new TransportError('offline');
    }
    await delay(this.conditions.current.latencyMs);
    if (!this.conditions.isOnline) {
      throw new TransportError('offline');
    }
  }
}
