import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ChatScreen } from '../features/chat/ChatScreen';
import { DevPanelScreen } from '../features/devtools/DevPanelScreen';
import { PaywallScreen } from '../features/paywall/PaywallScreen';
import { bootstrap, chatStore, paywallStore } from './container';
import { palette } from '../design/theme';

type Overlay = 'none' | 'paywall' | 'dev-panel';

export default function App() {
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>('none');

  useEffect(() => {
    let cancelled = false;

    bootstrap()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
      chatStore.getState().dispose();
      paywallStore.getState().dispose();
    };
  }, []);

  const closeOverlay = useCallback(() => setOverlay('none'), []);
  const openPaywall = useCallback(() => setOverlay('paywall'), []);
  const openDevPanel = useCallback(() => setOverlay('dev-panel'), []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      {ready ? (
        <ChatScreen onOpenPaywall={openPaywall} onOpenDevPanel={openDevPanel} />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.accent} />
        </View>
      )}

      <Modal
        visible={overlay !== 'none'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeOverlay}
      >
        {overlay === 'paywall' ? <PaywallScreen onClose={closeOverlay} /> : null}
        {overlay === 'dev-panel' ? <DevPanelScreen onClose={closeOverlay} /> : null}
      </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
});
