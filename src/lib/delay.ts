export function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function backoffDelay(attempt: number, baseMs = 500, maxMs = 15000): number {
  const exponential = baseMs * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(exponential, maxMs);
  const jitter = capped * 0.25 * Math.random();
  return Math.round(capped - jitter);
}
