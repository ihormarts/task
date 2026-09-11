import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '../../design/theme';
import {
  billing,
  chatServer,
  chatStore,
  conditions,
  entitlements,
  paywallStore,
  resetEverything,
} from '../../app/container';
import { formatReport } from '../../perf/frameRecorder';
import { getBenchmarkTarget } from '../../perf/benchmarkTarget';
import { perfStore } from '../../perf/perfStore';
import { runScrollAndTypeBenchmark } from '../../perf/benchmark';
import type { BillingBehaviour } from '../../services/billing/mockBillingService';
import type { IncomingDraft } from '../../services/chat/mockChatServer';

type Props = {
  onClose: () => void;
};

const CONFIRMATION_DELAYS: { label: string; value: number | null }[] = [
  { label: 'instant', value: 0 },
  { label: '4s', value: 4000 },
  { label: '20s', value: 20000 },
  { label: 'manual', value: null },
];

const INCOMING_BATCH: IncomingDraft[] = [
  { text: 'Missed you on the stream tonight' },
  { text: 'Dropping the behind the scenes tomorrow' },
  { text: 'Which thumbnail do you prefer, left or right' },
  { text: 'Thanks for sticking around this long' },
];

const RICH_BATCH: IncomingDraft[] = [
  { text: 'Here is the uncut take from last night', kind: 'media' },
  { text: 'gift', kind: 'gift', amountCents: 5000 },
];

export function DevPanelScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();

  const [online, setOnline] = useState(conditions.isOnline);
  const [dropResponses, setDropResponses] = useState(conditions.current.dropResponses);
  const [behaviour, setBehaviour] = useState<BillingBehaviour>(billing.behaviour);
  const [confirmationDelay, setConfirmationDelay] = useState<number | null>(
    entitlements.confirmationDelayMs,
  );

  const connection = useStore(chatStore, (state) => state.connection);
  const pendingCount = useStore(chatStore, (state) => state.pending.length);
  const entitlement = useStore(paywallStore, (state) => state.entitlement);
  const reports = useStore(perfStore, (state) => state.reports);
  const benchmarkRunning = useStore(perfStore, (state) => state.running);
  const unoptimisedList = useStore(perfStore, (state) => state.unoptimisedList);

  useEffect(() => conditions.changes.subscribe((snapshot) => setOnline(snapshot.online)), []);

  const toggleOnline = useCallback((next: boolean) => {
    conditions.update({ online: next });
  }, []);

  const toggleDropResponses = useCallback((next: boolean) => {
    setDropResponses(next);
    conditions.update({ dropResponses: next });
  }, []);

  const applyBehaviour = useCallback((next: BillingBehaviour) => {
    setBehaviour(next);
    billing.behaviour = next;
  }, []);

  const applyConfirmationDelay = useCallback((next: number | null) => {
    setConfirmationDelay(next);
    entitlements.confirmationDelayMs = next;
  }, []);

  const deliver = useCallback(async (drafts: IncomingDraft[]) => {
    await chatServer.appendIncoming(drafts);
    if (conditions.isOnline) {
      await chatStore.getState().pull();
    }
  }, []);

  const confirmEntitlement = useCallback(async () => {
    await entitlements.confirmAllPending();
    await paywallStore.getState().refreshEntitlement();
  }, []);

  const expireEntitlement = useCallback(async () => {
    await entitlements.expireEntitlement();
    await paywallStore.getState().refreshEntitlement();
  }, []);

  const runBenchmark = useCallback(async () => {
    const target = getBenchmarkTarget();
    if (target === null || perfStore.getState().running) {
      return;
    }

    perfStore.getState().setRunning(true);
    onClose();

    try {
      const report = await runScrollAndTypeBenchmark({
        label: perfStore.getState().unoptimisedList ? 'scroll+type (unoptimised)' : 'scroll+type',
        list: target.list,
        contentHeight: target.contentHeight,
      });
      perfStore.getState().addReport(report);
    } finally {
      perfStore.getState().setRunning(false);
    }
  }, [onClose]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Demo controls</Text>
        <Text style={styles.subtitle}>
          Connection {connection} · {pendingCount} queued · access {entitlement.status}
        </Text>

        <Section title="Network">
          <Row label="Online" hint="Turn off to queue sends locally">
            <Switch value={online} onValueChange={toggleOnline} accessibilityLabel="Network online" />
          </Row>
          <Row label="Drop responses" hint="Server accepts the send, the reply never arrives">
            <Switch
              value={dropResponses}
              onValueChange={toggleDropResponses}
              accessibilityLabel="Drop server responses"
            />
          </Row>
          <Action
            label="Inject one server outage"
            onPress={() => conditions.update({ injectedFailure: 'server-unavailable' })}
          />
          <Action
            label="Inject one rejected message"
            onPress={() => conditions.update({ injectedFailure: 'message-rejected' })}
          />
        </Section>

        <Section title="Incoming">
          <Action
            label={`Deliver ${INCOMING_BATCH.length} messages from the creator`}
            onPress={() => deliver(INCOMING_BATCH)}
          />
          <Action label="Deliver a video and a gift" onPress={() => deliver(RICH_BATCH)} />
          <Action label="Pull now" onPress={() => chatStore.getState().pull()} />
          <Action label="Flush outbox now" onPress={() => chatStore.getState().flush()} />
        </Section>

        <Section title="Billing">
          <View style={styles.segmented}>
            {(['succeed', 'cancel', 'fail'] as const).map((option) => (
              <Pressable
                key={option}
                style={[styles.segment, behaviour === option && styles.segmentActive]}
                onPress={() => applyBehaviour(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: behaviour === option }}
                accessibilityLabel={`Store behaviour: ${option}`}
              >
                <Text style={[styles.segmentText, behaviour === option && styles.segmentTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.segmented}>
            {CONFIRMATION_DELAYS.map(({ label, value: option }) => (
              <Pressable
                key={label}
                style={[styles.segment, confirmationDelay === option && styles.segmentActive]}
                onPress={() => applyConfirmationDelay(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: confirmationDelay === option }}
                accessibilityLabel={`Backend confirms access ${label}`}
              >
                <Text
                  style={[
                    styles.segmentText,
                    confirmationDelay === option && styles.segmentTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Action label="Confirm pending receipt now" onPress={confirmEntitlement} />
          <Action label="Expire access" onPress={expireEntitlement} />
        </Section>

        <Section title="Performance">
          <Row
            label="Unoptimised list"
            hint="Inline row renderers and extraData tied to the draft"
          >
            <Switch
              value={unoptimisedList}
              onValueChange={perfStore.getState().setUnoptimisedList}
              accessibilityLabel="Run the list without row memoisation"
            />
          </Row>
          <Action
            label={benchmarkRunning ? 'Running…' : 'Run scroll and type benchmark'}
            onPress={runBenchmark}
          />
          {reports.map((report, index) => (
            <Text key={`${report.label}-${index}`} style={styles.report}>
              {formatReport(report)}
            </Text>
          ))}
          {reports.length > 0 ? (
            <Action label="Clear measurements" onPress={perfStore.getState().clear} />
          ) : null}
        </Section>

        <Section title="Reset">
          <Action label="Reset everything" onPress={resetEverything} destructive />
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          style={styles.close}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close demo controls"
        >
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

function Action({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <Pressable
      style={styles.action}
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, destructive && styles.actionTextDestructive]}>{label}</Text>
    </Pressable>
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
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: palette.ink,
  },
  subtitle: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.label,
    color: palette.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET + 8,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: palette.ink,
  },
  rowHint: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  actionText: {
    ...typography.body,
    color: palette.accent,
  },
  actionTextDestructive: {
    color: palette.danger,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: palette.white,
  },
  segmentText: {
    ...typography.label,
    color: palette.inkMuted,
  },
  segmentTextActive: {
    color: palette.ink,
  },
  report: {
    ...typography.caption,
    color: palette.ink,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  close: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.bodyStrong,
    color: palette.accent,
  },
});
