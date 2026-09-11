import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '../../design/theme';
import { isEntitlementActive } from '../../domain/billing';
import { paywallStore } from '../../app/container';

type Props = {
  onClose: () => void;
};

export function PaywallScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();

  const products = useStore(paywallStore, (state) => state.products);
  const entitlement = useStore(paywallStore, (state) => state.entitlement);
  const phase = useStore(paywallStore, (state) => state.phase);
  const notice = useStore(paywallStore, (state) => state.notice);

  const product = products[0];
  const hasAccess = isEntitlementActive(entitlement);
  const busy = phase === 'purchasing' || phase === 'restoring';
  const awaitingConfirmation = phase === 'awaiting-confirmation' || entitlement.status === 'pending';

  const purchase = useCallback(() => {
    if (product) {
      void paywallStore.getState().purchase(product.id);
    }
  }, [product]);

  const restore = useCallback(() => {
    void paywallStore.getState().restore();
  }, []);

  if (!product) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.simulatedBadge}>Simulated billing</Text>

        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.description}>{product.description}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{product.priceLabel}</Text>
          <Text style={styles.period}>{product.periodLabel}</Text>
        </View>

        <View style={styles.benefits}>
          {product.benefits.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={styles.benefitDot} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {hasAccess ? (
          <View style={[styles.statusCard, styles.statusActive]}>
            <Text style={styles.statusTitle}>All Access is active</Text>
            <Text style={styles.statusBody}>
              Confirmed by the server. You can message this creator without limits.
            </Text>
          </View>
        ) : null}

        {awaitingConfirmation ? (
          <View
            style={[styles.statusCard, styles.statusPending]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={styles.statusTitle}>Payment received, confirming access</Text>
            <Text style={styles.statusBody}>
              The store accepted the purchase. Access opens once our server confirms the receipt.
            </Text>
          </View>
        ) : null}

        {notice ? (
          <View
            style={[styles.statusCard, styles.statusNotice]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={styles.statusBody}>{notice}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          style={[styles.primaryButton, (busy || hasAccess) && styles.primaryButtonDisabled]}
          onPress={purchase}
          disabled={busy || hasAccess}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || hasAccess, busy }}
          accessibilityLabel={`Subscribe to ${product.title} for ${product.priceLabel} ${product.periodLabel}`}
        >
          {phase === 'purchasing' ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {hasAccess ? 'Subscribed' : `Subscribe for ${product.priceLabel}`}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={restore}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy: phase === 'restoring' }}
          accessibilityLabel="Restore an existing purchase"
        >
          <Text style={styles.secondaryButtonText}>
            {phase === 'restoring' ? 'Restoring…' : 'Restore purchase'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close subscription options"
        >
          <Text style={styles.closeText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  simulatedBadge: {
    ...typography.caption,
    color: palette.warning,
    backgroundColor: palette.warningSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: palette.ink,
  },
  description: {
    ...typography.body,
    color: palette.inkMuted,
    marginTop: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xl,
  },
  price: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: palette.ink,
  },
  period: {
    ...typography.body,
    color: palette.inkMuted,
    marginLeft: spacing.sm,
  },
  benefits: {
    marginTop: spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  benefitDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    marginRight: spacing.md,
  },
  benefitText: {
    ...typography.body,
    color: palette.ink,
  },
  statusCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  statusActive: {
    backgroundColor: palette.successSoft,
  },
  statusPending: {
    backgroundColor: palette.warningSoft,
  },
  statusNotice: {
    backgroundColor: palette.surface,
  },
  statusTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
    marginBottom: spacing.xs,
  },
  statusBody: {
    ...typography.label,
    color: palette.ink,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  primaryButton: {
    minHeight: MIN_TOUCH_TARGET + 4,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: palette.inkSubtle,
  },
  primaryButtonText: {
    ...typography.bodyStrong,
    color: palette.white,
  },
  secondaryButton: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.label,
    color: palette.accent,
  },
  closeText: {
    ...typography.label,
    color: palette.inkMuted,
  },
});
