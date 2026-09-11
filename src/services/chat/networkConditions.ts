import { Emitter } from '../../lib/emitter';
import type { TransportErrorCode } from '../../domain/errors';

export type NetworkSnapshot = {
  online: boolean;
  latencyMs: number;
  dropResponses: boolean;
  injectedFailure: TransportErrorCode | null;
};

const INITIAL: NetworkSnapshot = {
  online: true,
  latencyMs: 180,
  dropResponses: false,
  injectedFailure: null,
};

export class NetworkConditions {
  private snapshot: NetworkSnapshot = { ...INITIAL };

  readonly changes = new Emitter<NetworkSnapshot>();

  get current(): NetworkSnapshot {
    return this.snapshot;
  }

  get isOnline(): boolean {
    return this.snapshot.online;
  }

  update(patch: Partial<NetworkSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.changes.emit(this.snapshot);
  }

  consumeInjectedFailure(): TransportErrorCode | null {
    const failure = this.snapshot.injectedFailure;
    if (failure !== null) {
      this.update({ injectedFailure: null });
    }
    return failure;
  }

  reset(): void {
    this.snapshot = { ...INITIAL };
    this.changes.emit(this.snapshot);
  }
}
