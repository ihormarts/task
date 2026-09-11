import { FrameRecorder } from './frameRecorder';
import { composerStore } from '../features/chat/composerStore';
import { delay } from '../lib/delay';
import type { FrameReport } from './frameRecorder';

const SCROLL_STEPS = 24;
const SCROLL_STEP_MS = 140;
const TYPING_FRAGMENT = 'measuring the composer under load ';
const TYPING_KEYSTROKES = 60;
const TYPING_KEYSTROKE_MS = 45;

export type ScrollTarget = {
  scrollToOffset: (options: { offset: number; animated: boolean }) => void;
};

export type BenchmarkOptions = {
  label: string;
  list: ScrollTarget;
  contentHeight: number;
};

export async function runScrollAndTypeBenchmark({
  label,
  list,
  contentHeight,
}: BenchmarkOptions): Promise<FrameReport> {
  const recorder = new FrameRecorder();
  recorder.start();

  const stride = contentHeight / SCROLL_STEPS;

  for (let step = SCROLL_STEPS; step > 0; step -= 1) {
    list.scrollToOffset({ offset: stride * step, animated: false });
    await delay(SCROLL_STEP_MS);
  }

  composerStore.getState().clear();
  for (let keystroke = 0; keystroke < TYPING_KEYSTROKES; keystroke += 1) {
    composerStore
      .getState()
      .appendToDraft(TYPING_FRAGMENT[keystroke % TYPING_FRAGMENT.length]);
    await delay(TYPING_KEYSTROKE_MS);
  }
  composerStore.getState().clear();

  return recorder.stop(label);
}
