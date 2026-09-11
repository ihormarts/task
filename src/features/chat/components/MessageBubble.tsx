import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '../../../design/theme';
import { formatClock } from '../../../lib/time';
import type { ConfirmedMessage } from '../../../domain/message';

const CREATOR_INITIAL = 'E';

type Props = {
  message: ConfirmedMessage;
};

function MessageBubbleComponent({ message }: Props) {
  const own = message.author === 'fan';
  const clock = formatClock(message.createdAt);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${own ? 'You' : 'Ethan Shoots'} at ${clock}. ${message.text}`}
    >
      {own ? null : (
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{CREATOR_INITIAL}</Text>
        </View>
      )}

      <View style={[styles.bubble, own && styles.bubbleOwn]}>
        <Text style={styles.text}>{message.text}</Text>
        <Text style={styles.timestamp}>{clock}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarInitial: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.accent,
  },
  bubble: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  bubbleOwn: {
    marginLeft: spacing.xxl + spacing.xs,
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
