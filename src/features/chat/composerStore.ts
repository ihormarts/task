import { createStore } from 'zustand/vanilla';

export const MAX_MESSAGE_LENGTH = 400;

export type ComposerState = {
  draft: string;
  setDraft: (draft: string) => void;
  appendToDraft: (fragment: string) => void;
  clear: () => void;
};

export const composerStore = createStore<ComposerState>((set, get) => ({
  draft: '',
  setDraft: (draft) => set({ draft: draft.slice(0, MAX_MESSAGE_LENGTH) }),
  appendToDraft: (fragment) =>
    set({ draft: (get().draft + fragment).slice(0, MAX_MESSAGE_LENGTH) }),
  clear: () => set({ draft: '' }),
}));
