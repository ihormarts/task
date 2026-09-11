import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '../../../design/theme';
import type { PendingMessage } from '../../../domain/message';

type Props = {
  message: PendingMessage;
  offline: boolean;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onOpenPaywall: () => void;
};

function statusLabel(message: PendingMessage, offline: boolean): string {
  if (message.status === 'failed') {
    return 'Not sent';
  }
  if (message.status === 'sending') {
    return 'Sending';
  }
  return offline ? 'Waiting for connection' : 'Waiting to send';
}

function PendingBubbleComponent({ message, offline, onRetry, onDiscard, onOpenPaywall }: Props) {
  const failed = message.status === 'failed';

  const handleRetry = useCallback(() => onRetry(message.clientId), [message.clientId, onRetry]);
  const handleDiscard = useCallback(() => onDiscard(message.clientId), [message.clientId, onDiscard]);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`You. ${message.text}. ${statusLabel(message, offline)}.`}
    >
      <View style={[styles.bubble, failed && styles.bubbleFailed]}>
        <Text style={styles.text}>{message.text}</Text>

        <View style={styles.statusRow}>
          <View style={[styles.dot, failed ? styles.dotFailed : styles.dotPending]} />
          <Text style={[styles.status, failed && styles.statusFailed]}>
            {statusLabel(message, offline)}
          </Text>
        </View>

        {failed && message.failure ? (
          <View style={styles.failureBlock}>
            <Text style={styles.failureText}>{message.failure.message}</Text>
            <View style={styles.actions}>
              {message.failure.action === 'open-paywall' ? (
                <Pressable
                  style={styles.action}
                  onPress={onOpenPaywall}
                  accessibilityRole="button"
                  accessibilityLabel="Open subscription options"
                >
                  <Text style={styles.actionText}>Subscribe</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.action}
                  onPress={handleRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Retry sending this message"
                >
                  <Text style={styles.actionText}>Try again</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.action}
                onPress={handleDiscard}
                accessibilityRole="button"
                accessibilityLabel="Discard this message"
              >
                <Text style={styles.actionTextMuted}>Discard</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingRight: spacing.sm,
    paddingBottom: spacing.md,
  },
  bubble: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    opacity: 0.85,
  },
  bubbleFailed: {
    backgroundColor: palette.dangerSoft,
    opacity: 1,
  },
  text: {
    ...typography.body,
    color: palette.ink,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    marginRight: spacing.xs + 2,
  },
  dotPending: {
    backgroundColor: palette.inkSubtle,
  },
  dotFailed: {
    backgroundColor: palette.danger,
  },
  status: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  statusFailed: {
    color: palette.danger,
  },
  failureBlock: {
    marginTop: spacing.sm,
  },
  failureText: {
    ...typography.caption,
    color: palette.ink,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingRight: spacing.lg,
  },
  actionText: {
    ...typography.label,
    color: palette.accent,
  },
  actionTextMuted: {
    ...typography.label,
    color: palette.inkMuted,
  },
});

export const PendingBubble = memo(PendingBubbleComponent);
