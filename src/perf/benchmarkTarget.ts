import type { ScrollTarget } from './benchmark';

const ESTIMATED_ROW_HEIGHT = 96;

let currentList: ScrollTarget | null = null;
let currentItemCount = 0;

export function registerBenchmarkList(list: ScrollTarget | null, itemCount: number): void {
  currentList = list;
  currentItemCount = itemCount;
}

export function getBenchmarkTarget(): { list: ScrollTarget; contentHeight: number } | null {
  if (currentList === null || currentItemCount === 0) {
    return null;
  }
  return {
    list: currentList,
    contentHeight: currentItemCount * ESTIMATED_ROW_HEIGHT,
  };
}
