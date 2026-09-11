import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '../../../design/theme';
import { formatClock } from '../../../lib/time';
import type { ConfirmedMessage } from '../../../domain/message';

const CREATOR_INITIAL = 'E';

type Props = {
  message: ConfirmedMessage;
};

function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

function describe(message: ConfirmedMessage): string {
  if (message.kind === 'gift' && message.amountCents !== undefined) {
    return `Gift of ${formatAmount(message.amountCents)}`;
  }
  if (message.kind === 'media') {
    return `Video. ${message.text}`;
  }
  return message.text;
}

function MessageBubbleComponent({ message }: Props) {
  const own = message.author === 'fan';
  const clock = formatClock(message.createdAt);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${own ? 'You' : 'Ethan Shoots'} at ${clock}. ${describe(message)}`}
    >
      {own ? null : (
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{CREATOR_INITIAL}</Text>
        </View>
      )}

      <View style={[styles.bubble, own && styles.bubbleOwn]}>
        {message.kind === 'media' ? (
          <View style={styles.media}>
            <View style={styles.playBadge}>
              <Text style={styles.playGlyph}>▶</Text>
            </View>
          </View>
        ) : null}

        {message.kind === 'gift' && message.amountCents !== undefined ? (
          <View style={styles.gift}>
            <View style={styles.giftIcon}>
              <Text style={styles.giftGlyph}>◈</Text>
            </View>
            <Text style={styles.giftText}>
              {own ? 'You sent' : 'Ethan sent'} a {formatAmount(message.amountCents)} gift
            </Text>
          </View>
        ) : (
          <Text style={styles.text}>{message.text}</Text>
        )}

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
  media: {
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  playBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    ...typography.body,
    color: palette.ink,
    marginLeft: 2,
  },
  gift: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  giftIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  giftGlyph: {
    ...typography.label,
    color: palette.accent,
  },
  giftText: {
    ...typography.body,
    color: palette.ink,
    flex: 1,
  },
});

export const MessageBubble = memo(MessageBubbleComponent);
