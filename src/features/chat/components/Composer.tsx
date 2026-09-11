import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';

import { MAX_MESSAGE_LENGTH, composerStore } from '../composerStore';
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '../../../design/theme';

type Props = {
  hasAccess: boolean;
  offline: boolean;
  onSend: (text: string) => void;
  onOpenPaywall: () => void;
};

function ComposerComponent({ hasAccess, offline, onSend, onOpenPaywall }: Props) {
  const draft = useStore(composerStore, (state) => state.draft);
  const setDraft = useStore(composerStore, (state) => state.setDraft);

  const canSend = draft.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) {
      return;
    }
    onSend(draft);
    composerStore.getState().clear();
  }, [canSend, draft, onSend]);

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <Pressable
          style={styles.lockedCta}
          onPress={onOpenPaywall}
          accessibilityRole="button"
          accessibilityLabel="Subscribe to All Access to send messages"
        >
          <Text style={styles.lockedCtaText}>Subscribe to send messages</Text>
        </Pressable>
        <Text style={styles.lockedHint}>All Access unlocks direct messages with this creator.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={palette.inkSubtle}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
          accessibilityLabel="Message text"
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />

        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          accessibilityLabel={offline ? 'Queue message to send when online' : 'Send message'}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {draft.length}/{MAX_MESSAGE_LENGTH}
        </Text>
        <Text style={styles.meta}>{offline ? 'Queued while offline' : 'Available messages: Unlimited'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.white,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    ...typography.body,
    color: palette.ink,
    flex: 1,
    maxHeight: 112,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: palette.inkSubtle,
  },
  sendIcon: {
    ...typography.bodyStrong,
    color: palette.white,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  lockedCta: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCtaText: {
    ...typography.bodyStrong,
    color: palette.white,
  },
  lockedHint: {
    ...typography.caption,
    color: palette.inkMuted,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
});

export const Composer = memo(ComposerComponent);
