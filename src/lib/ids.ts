const HEX = '0123456789abcdef';

function randomHex(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function createClientId(): string {
  return `${Date.now().toString(36)}-${randomHex(12)}`;
}

export function createTransactionId(): string {
  return `txn_${Date.now().toString(36)}_${randomHex(8)}`;
}
