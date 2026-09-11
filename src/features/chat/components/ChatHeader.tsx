import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, hitSlop, palette, radius, spacing, typography } from '../../../design/theme';

type Props = {
  creatorName: string;
  creatorHandle: string;
  hasAccess: boolean;
  onOpenPaywall: () => void;
  onOpenDevPanel: () => void;
};

function ChatHeaderComponent({
  creatorName,
  creatorHandle,
  hasAccess,
  onOpenPaywall,
  onOpenDevPanel,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Chat with</Text>
        <Pressable
          onPress={onOpenDevPanel}
          hitSlop={hitSlop}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Open demo controls"
        >
          <Text style={styles.icon}>•••</Text>
        </Pressable>
      </View>

      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{creatorName.charAt(0)}</Text>
        </View>

        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {creatorName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {creatorHandle}
          </Text>
        </View>

        <Pressable
          onPress={onOpenPaywall}
          style={[styles.badge, hasAccess ? styles.badgeActive : styles.badgeLocked]}
          accessibilityRole="button"
          accessibilityLabel={
            hasAccess ? 'You have All Access. View subscription details' : 'Subscribe to All Access'
          }
        >
          <Text style={[styles.badgeText, hasAccess ? styles.badgeTextActive : styles.badgeTextLocked]}>
            {hasAccess ? 'Fan in All Access' : 'Get All Access'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.white,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  title: {
    ...typography.title,
    color: palette.ink,
  },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  icon: {
    ...typography.title,
    color: palette.inkMuted,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.bodyStrong,
    color: palette.accent,
  },
  identityText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  handle: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minHeight: 32,
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: palette.accentSoft,
  },
  badgeLocked: {
    backgroundColor: palette.accent,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: palette.accent,
  },
  badgeTextLocked: {
    color: palette.white,
  },
});

export const ChatHeader = memo(ChatHeaderComponent);
