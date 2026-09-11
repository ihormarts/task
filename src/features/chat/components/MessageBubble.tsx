import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '../../../design/theme';
import { formatClock } from '../../../lib/time';
import type { ConfirmedMessage } from '../../../domain/message';

type Props = {
  message: ConfirmedMessage;
};

function MessageBubbleComponent({ message }: Props) {
  const own = message.author === 'fan';

  return (
    <View
      style={[styles.row, own ? styles.rowOwn : styles.rowIncoming]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${own ? 'You' : 'Ethan Shoots'} at ${formatClock(message.createdAt)}. ${message.text}`}
    >
      <View style={styles.bubble}>
        <Text style={styles.text}>{message.text}</Text>
        <Text style={styles.timestamp}>{formatClock(message.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  rowIncoming: {
    paddingLeft: spacing.xxl + spacing.sm,
  },
  rowOwn: {
    paddingRight: spacing.sm,
  },
  bubble: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: palette.ink,
  },
  timestamp: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: spacing.sm,
  },
});

export const MessageBubble = memo(MessageBubbleComponent);
