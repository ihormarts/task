import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '../../../design/theme';
import type { ConnectionState } from '../chatStore';

type Props = {
  connection: ConnectionState;
  queuedCount: number;
};

function bannerContent(connection: ConnectionState, queuedCount: number) {
  if (connection === 'offline') {
    return {
      text:
        queuedCount > 0
          ? `Offline. ${queuedCount} message${queuedCount === 1 ? '' : 's'} will send when you reconnect.`
          : 'Offline. New messages will send when you reconnect.',
      tone: 'warning' as const,
    };
  }
  if (connection === 'syncing') {
    return { text: 'Reconnecting and catching up…', tone: 'neutral' as const };
  }
  return null;
}

function ConnectionBannerComponent({ connection, queuedCount }: Props) {
  const content = bannerContent(connection, queuedCount);

  if (content === null) {
    return null;
  }

  return (
    <View
      style={[styles.container, content.tone === 'warning' ? styles.warning : styles.neutral]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.text, content.tone === 'warning' ? styles.textWarning : styles.textNeutral]}>
        {content.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  warning: {
    backgroundColor: palette.warningSoft,
  },
  neutral: {
    backgroundColor: palette.surfaceStrong,
  },
  text: {
    ...typography.caption,
    textAlign: 'center',
  },
  textWarning: {
    color: palette.warning,
  },
  textNeutral: {
    color: palette.inkMuted,
  },
});

export const ConnectionBanner = memo(ConnectionBannerComponent);
