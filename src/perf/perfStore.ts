import { createStore } from 'zustand/vanilla';

import type { FrameReport } from './frameRecorder';

export type PerfState = {
  reports: FrameReport[];
  running: boolean;
  unoptimisedList: boolean;
  addReport: (report: FrameReport) => void;
  setRunning: (running: boolean) => void;
  setUnoptimisedList: (unoptimised: boolean) => void;
  clear: () => void;
};

export const perfStore = createStore<PerfState>((set) => ({
  reports: [],
  running: false,
  unoptimisedList: false,
  addReport: (report) => set((state) => ({ reports: [report, ...state.reports].slice(0, 8) })),
  setRunning: (running) => set({ running }),
  setUnoptimisedList: (unoptimisedList) => set({ unoptimisedList }),
  clear: () => set({ reports: [] }),
}));
