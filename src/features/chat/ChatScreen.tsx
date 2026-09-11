import { useCallback, useEffect, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

type Props = {
  onOpenPaywall: () => void;
  onOpenDevPanel: () => void;
};

export function ChatScreen({ onOpenPaywall, onOpenDevPanel }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashList<ThreadItem>>(null);

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
    void chatStore.getState().send(text);
  }, []);

  const retry = useCallback((clientId: string) => {
    void chatStore.getState().retry(clientId);
  }, []);

  const discard = useCallback((clientId: string) => {
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
          onDiscard={discard}
          onOpenPaywall={onOpenPaywall}
        />
      );
    },
    [connection, discard, onOpenPaywall, retry],
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
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
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
  listRef: React.RefObject<FlashList<ThreadItem> | null>;
  thread: ThreadItem[];
  connection: ReturnType<typeof chatStore.getState>['connection'];
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onOpenPaywall: () => void;
  onStartReached: () => void;
};

function UnoptimisedThreadList({
  listRef,
  thread,
  connection,
  onRetry,
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
  },
});
