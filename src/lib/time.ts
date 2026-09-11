const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatClock(timestamp: number): string {
  return CLOCK_FORMATTER.format(new Date(timestamp)).toLowerCase();
}

export function formatRelativeDays(timestamp: number, now = Date.now()): string {
  const days = Math.round((timestamp - now) / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return 'tomorrow';
  }
  return `in ${days} days`;
}
