const TARGET_FRAME_MS = 1000 / 60;
const DROPPED_THRESHOLD_MS = TARGET_FRAME_MS * 1.5;

export type FrameReport = {
  label: string;
  durationMs: number;
  frameCount: number;
  averageFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  droppedFrames: number;
  heapUsedMb: number | null;
};

type HermesStats = {
  'hermes:heapSize'?: number;
  'hermes:allocatedBytes'?: number;
};

function readHeapUsedMb(): number | null {
  const hermes = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => HermesStats } })
    .HermesInternal;

  const stats = hermes?.getInstrumentedStats?.();
  const allocated = stats?.['hermes:allocatedBytes'];

  return typeof allocated === 'number' ? Number((allocated / 1024 / 1024).toFixed(1)) : null;
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}

export class FrameRecorder {
  private intervals: number[] = [];

  private lastFrameAt = 0;

  private startedAt = 0;

  private handle: number | null = null;

  start(): void {
    this.intervals = [];
    this.startedAt = Date.now();
    this.lastFrameAt = 0;
    this.tick();
  }

  stop(label: string): FrameReport {
    if (this.handle !== null) {
      cancelAnimationFrame(this.handle);
      this.handle = null;
    }

    const durationMs = Date.now() - this.startedAt;
    const sorted = [...this.intervals].sort((left, right) => left - right);

    return {
      label,
      durationMs,
      frameCount: this.intervals.length,
      averageFps:
        durationMs > 0 ? Number(((this.intervals.length / durationMs) * 1000).toFixed(1)) : 0,
      medianFrameMs: Number(percentile(sorted, 0.5).toFixed(1)),
      p95FrameMs: Number(percentile(sorted, 0.95).toFixed(1)),
      worstFrameMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(1)),
      droppedFrames: this.intervals.filter((interval) => interval > DROPPED_THRESHOLD_MS).length,
      heapUsedMb: readHeapUsedMb(),
    };
  }

  private tick = (): void => {
    this.handle = requestAnimationFrame((timestamp) => {
      if (this.lastFrameAt > 0) {
        this.intervals.push(timestamp - this.lastFrameAt);
      }
      this.lastFrameAt = timestamp;
      this.tick();
    });
  };
}

export function formatReport(report: FrameReport): string {
  return [
    report.label,
    `${(report.durationMs / 1000).toFixed(1)}s`,
    `${report.averageFps} fps`,
    `p95 ${report.p95FrameMs}ms`,
    `worst ${report.worstFrameMs}ms`,
    `${report.droppedFrames} dropped`,
    report.heapUsedMb === null ? 'heap n/a' : `heap ${report.heapUsedMb}MB`,
  ].join(' · ');
}
