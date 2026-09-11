import { useCallback, useEffect, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { ChatHeader } from './components/ChatHeader';
import { Composer } from './components/Composer';
import { ConnectionBanner } from './components/ConnectionBanner';
import { DaySeparator } from './components/DaySeparator';
import { MessageBubble } from './components/MessageBubble';
import { PendingBubble } from './components/PendingBubble';
import { composerStore } from './composerStore';
import { isEntitlementActive } from '../../domain/billing';
import { palette } from '../../design/theme';
import { chatStore, paywallStore } from '../../app/container';
import { perfStore } from '../../perf/perfStore';
import { registerBenchmarkList } from '../../perf/benchmarkTarget';
import type { ThreadItem } from '../../domain/message';

const CREATOR_NAME = 'Ethan Shoots';
const CREATOR_HANDLE = '@ethan_shoots';

const SCROLL_SETTLE_STEPS_MS = [120, 350];

const MAINTAIN_POSITION = {
  startRenderingFromBottom: true,
  autoscrollToBottomThreshold: 0.2,
} as const;

type Props = {
  onOpenPaywall: () => void;
  onOpenDevPanel: () => void;
};

export function ChatScreen({ onOpenPaywall, onOpenDevPanel }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ThreadItem>>(null);
  const scrollAfterNextChange = useRef(false);

  const thread = useStore(chatStore, (state) => state.thread);
  const connection = useStore(chatStore, (state) => state.connection);
  const pending = useStore(chatStore, (state) => state.pending);
  const hasMoreHistory = useStore(chatStore, (state) => state.hasMoreHistory);
  const entitlement = useStore(paywallStore, (state) => state.entitlement);
  const unoptimisedList = useStore(perfStore, (state) => state.unoptimisedList);

  const hasAccess = isEntitlementActive(entitlement);
  const queuedCount = useMemo(
    () => pending.filter((entry) => entry.status !== 'failed').length,
    [pending],
  );

  const send = useCallback((text: string) => {
    scrollAfterNextChange.current = true;
    void chatStore.getState().send(text);
  }, []);

  const retry = useCallback((clientId: string) => {
    void chatStore.getState().retry(clientId);
  }, []);

  const discard = useCallback((clientId: string) => {
    void chatStore.getState().discard(clientId);
  }, []);

  const edit = useCallback((clientId: string, text: string) => {
    composerStore.getState().setDraft(text);
    void chatStore.getState().discard(clientId);
  }, []);

  const loadOlder = useCallback(() => {
    if (hasMoreHistory) {
      void chatStore.getState().loadOlder();
    }
  }, [hasMoreHistory]);

  useEffect(() => {
    registerBenchmarkList(listRef.current, thread.length);
  }, [thread.length]);

  useEffect(() => {
    if (!scrollAfterNextChange.current) {
      return undefined;
    }
    scrollAfterNextChange.current = false;

    const timers = SCROLL_SETTLE_STEPS_MS.map((delayMs) =>
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), delayMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [thread.length]);

  const renderItem = useCallback(
    ({ item }: { item: ThreadItem }) => {
      if (item.type === 'day-separator') {
        return <DaySeparator label={item.label} />;
      }
      if (item.type === 'confirmed') {
        return <MessageBubble message={item.message} />;
      }
      return (
        <PendingBubble
          message={item.message}
          offline={connection === 'offline'}
          onRetry={retry}
          onEdit={edit}
          onDiscard={discard}
          onOpenPaywall={onOpenPaywall}
        />
      );
    },
    [connection, discard, edit, onOpenPaywall, retry],
  );

  const keyExtractor = useCallback((item: ThreadItem) => item.key, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ChatHeader
        creatorName={CREATOR_NAME}
        creatorHandle={CREATOR_HANDLE}
        hasAccess={hasAccess}
        onOpenPaywall={onOpenPaywall}
        onOpenDevPanel={onOpenDevPanel}
      />

      <ConnectionBanner connection={connection} queuedCount={queuedCount} />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {unoptimisedList ? (
          <UnoptimisedThreadList
            listRef={listRef}
            thread={thread}
            connection={connection}
            onRetry={retry}
            onEdit={edit}
            onDiscard={discard}
            onOpenPaywall={onOpenPaywall}
            onStartReached={loadOlder}
          />
        ) : (
          <FlashList
            ref={listRef}
            data={thread}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            onStartReached={loadOlder}
            onStartReachedThreshold={0.4}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            maintainVisibleContentPosition={MAINTAIN_POSITION}
          />
        )}

        <View style={{ paddingBottom: insets.bottom }}>
          <Composer
            hasAccess={hasAccess}
            offline={connection === 'offline'}
            onSend={send}
            onOpenPaywall={onOpenPaywall}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

type UnoptimisedProps = {
  listRef: React.RefObject<FlashListRef<ThreadItem> | null>;
  thread: ThreadItem[];
  connection: ReturnType<typeof chatStore.getState>['connection'];
  onRetry: (clientId: string) => void;
  onEdit: (clientId: string, text: string) => void;
  onDiscard: (clientId: string) => void;
  onOpenPaywall: () => void;
  onStartReached: () => void;
};

function UnoptimisedThreadList({
  listRef,
  thread,
  connection,
  onRetry,
  onEdit,
  onDiscard,
  onOpenPaywall,
  onStartReached,
}: UnoptimisedProps) {
  const draft = useStore(composerStore, (state) => state.draft);

  return (
    <FlashList
      ref={listRef}
      data={thread}
      extraData={draft}
      keyExtractor={(item) => item.key}
      onStartReached={onStartReached}
      onStartReachedThreshold={0.4}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        if (item.type === 'day-separator') {
          return <DaySeparator label={item.label} />;
        }
        if (item.type === 'confirmed') {
          return <MessageBubble message={item.message} />;
        }
        return (
          <PendingBubble
            message={item.message}
            offline={connection === 'offline'}
            onRetry={(clientId) => onRetry(clientId)}
            onEdit={(clientId, text) => onEdit(clientId, text)}
            onDiscard={(clientId) => onDiscard(clientId)}
            onOpenPaywall={() => onOpenPaywall()}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
  },
  body: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
});
