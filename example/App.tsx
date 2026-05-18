import { crash, hang, init, nativeAvailable, post, postFeedback } from '@bugsplat/expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import appJson from './app.json';
import {
  ActivityEntry,
  ActivityType,
  formatRelativeTime,
  getActivity,
  recordActivity,
} from './src/activity-log';
import { useShake } from './src/use-shake';

// Single source of truth: read directly from app.json. Metro bundles JSON
// natively, and the values we need are static — so we skip expo-constants
// (which had a Kotlin override mismatch with expo-modules-core 55.0.17 on
// Android). The plugin throws at prebuild if any of these are missing, so
// by the time this runs they're guaranteed present.
type PluginEntry = string | [string, Record<string, unknown>?];
const pluginEntries = (appJson.expo.plugins ?? []) as PluginEntry[];
const bugsplatPlugin = pluginEntries.find(
  (entry): entry is [string, { database?: string }] =>
    Array.isArray(entry) && entry[0] === '@bugsplat/expo'
);
const rawDatabase = bugsplatPlugin?.[1]?.database;
if (!rawDatabase) {
  throw new Error('@bugsplat/expo: database missing from app.json plugin config');
}
const DATABASE: string = rawDatabase;

// Mirror the values the symbol-upload scripts use, so JS init() reconciles
// with uploaded symbols under one app identity per platform:
//   - iOS  → PRODUCT_NAME      (= expo.name)
//   - Android → applicationId  (= expo.android.package)
// Version is shared: expo.version → MARKETING_VERSION (iOS) / versionName (Android).
const rawAppName = Platform.select({
  ios: appJson.expo.name,
  android: appJson.expo.android?.package,
  default: appJson.expo.name,
});
const rawAppVersion = appJson.expo.version;
if (!rawAppName || !rawAppVersion) {
  throw new Error(
    '@bugsplat/expo: app.json must define expo.version, expo.name (iOS), and expo.android.package (Android)'
  );
}
const APP_NAME: string = rawAppName;
const APP_VERSION: string = rawAppVersion;
const SDK_VERSION = '0.6.0';

const COLORS = {
  screenBg: '#FAF8F2',
  cardBg: '#FFFFFF',
  cardStroke: '#ECEAE2',
  textPrimary: '#0E1116',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  link: '#1F73E8',
  badgeBg: '#F1EFE8',
  connectedBg: '#FFFFFF',
  connectedStroke: '#E4E2DA',
  connectedDot: '#22C55E',
  activityCrash: '#1F73E8',
  activityError: '#E5B142',
  activityFeedback: '#22C55E',
  activityHang: '#E5B142',
};

// crash() only produces a real native crash in a release build with the
// native module loaded. In Expo Go or a dev build, RN's error boundary
// swallows it as a JS error — disable the card so the label isn't a lie.
const crashDisabled = __DEV__ || !nativeAvailable;
// hang() is a no-op on web (no native main thread to freeze; the web shim
// just logs a warning), so disable the card there.
const hangDisabled = Platform.OS === 'web';

const CARDS: Array<{
  key: ActivityType;
  icon: ReturnType<typeof require>;
  title: string;
  subtitle: string;
  disabled?: boolean;
  disabledHint?: string;
}> = [
  {
    key: 'crash',
    icon: require('./assets/splat_crash.png'),
    title: 'Crash',
    subtitle: 'Native crash · stack + threads + memory',
    disabled: crashDisabled,
    disabledHint: !nativeAvailable
      ? 'Native crash testing requires a development build (not Expo Go)'
      : 'Native crash testing requires a release build',
  },
  {
    key: 'error',
    icon: require('./assets/splat_error.png'),
    title: 'Non-Crash Error',
    subtitle: 'Exception caught · app keeps running',
  },
  {
    key: 'feedback',
    icon: require('./assets/splat_feedback.png'),
    title: 'User Feedback',
    subtitle: 'Open the feedback sheet',
  },
  {
    key: 'hang',
    icon: require('./assets/splat_hang.png'),
    title: 'Hang',
    subtitle: 'Freeze main thread (native hang report)',
    disabled: hangDisabled,
    disabledHint: hangDisabled ? 'Native hang detection is not available on web' : undefined,
  },
];

function activityDotColor(type: ActivityType): string {
  switch (type) {
    case 'crash': return COLORS.activityCrash;
    case 'error': return COLORS.activityError;
    case 'feedback': return COLORS.activityFeedback;
    case 'hang': return COLORS.activityHang;
  }
}

function activityLabel(type: ActivityType): string {
  switch (type) {
    case 'crash': return 'Crash';
    case 'error': return 'Error';
    case 'feedback': return 'Feedback';
    case 'hang': return 'Hang';
  }
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [statusText, setStatusText] = useState('Shake the device to send feedback anytime.');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const sendingRef = useRef(false);

  const refreshActivity = useCallback(async () => {
    const list = await getActivity();
    setEntries(list);
    setNowTick(Date.now());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await init(DATABASE, APP_NAME, APP_VERSION);
        setConnected(true);
      } catch {
        setConnected(false);
      }
      await refreshActivity();
    })();
  }, [refreshActivity]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshActivity();
    });
    return () => sub.remove();
  }, [refreshActivity]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const onCrash = useCallback(async () => {
    // Persist BEFORE triggering the native crash so the entry survives process death.
    await recordActivity('crash', 'Native crash triggered');
    crash();
  }, []);

  const onError = useCallback(async () => {
    try {
      const x: unknown = null;
      (x as { length: number }).length;
    } catch (e) {
      const name = e instanceof Error ? e.constructor.name : 'Error';
      await recordActivity('error', `${name} caught`);
      await refreshActivity();
      setStatusText(`Caught: ${name} — app still running`);
      if (e instanceof Error) post(e).catch(() => {});
    }
  }, [refreshActivity]);

  const onHang = useCallback(async () => {
    const fire = async () => {
      // Persist BEFORE triggering the hang so the entry survives ANR-kill / force-quit.
      await recordActivity('hang', 'Main thread frozen');
      hang();
    };
    // iOS hang flow needs user action — the BugSplat-Apple hang tracker
    // persists the report once the threshold trips, but the actual upload only
    // happens on next launch. Walk the user through force-quit + relaunch so
    // they aren't left staring at a frozen UI wondering what happens next.
    // Android's ANR detector handles all of this automatically via the system
    // "App not responding" dialog, so no extra confirmation needed there.
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Freeze the main thread?',
        'The UI will hang indefinitely. After 2+ seconds, BugSplat-Apple\'s tracker persists a fatal-hang report to disk. Force-quit from the app switcher to end the freeze, then relaunch — the report uploads on next launch.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Freeze', style: 'destructive', onPress: fire },
        ]
      );
      return;
    }
    await fire();
  }, []);

  const onFeedback = useCallback(() => {
    setFeedbackTitle('');
    setFeedbackBody('');
    setFeedbackOpen(true);
  }, []);

  // Shake-to-feedback: matches the Android demo's ShakeDetector behavior.
  // Disabled while the modal is open so the user can't re-trigger it mid-input.
  useShake(onFeedback, { enabled: !feedbackOpen });

  const onSubmitFeedback = useCallback(async () => {
    if (sendingRef.current) return;
    const title = feedbackTitle.trim();
    if (!title) return;
    sendingRef.current = true;
    setStatusText('Sending feedback...');
    setFeedbackOpen(false);
    try {
      const result = await postFeedback(title, { description: feedbackBody.trim() || undefined });
      if (result.success) {
        setStatusText('Feedback sent — thank you!');
        await recordActivity('feedback', `“${title}”`);
        await refreshActivity();
      } else {
        setStatusText('Failed to send feedback');
      }
    } catch {
      setStatusText('Failed to send feedback');
    } finally {
      sendingRef.current = false;
    }
  }, [feedbackTitle, feedbackBody, refreshActivity]);

  const onViewDashboard = useCallback(() => {
    const url = `https://app.bugsplat.com/v2/dashboard?database=${encodeURIComponent(DATABASE)}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const handlers: Record<ActivityType, () => void | Promise<void>> = {
    crash: onCrash,
    error: onError,
    feedback: onFeedback,
    hang: onHang,
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <View style={styles.wordmarkWrap}>
              <Image source={require('./assets/bugsplat_wordmark.png')} style={styles.wordmark} resizeMode="contain" />
            </View>
            <View style={styles.topBarRight}>
              <Text style={styles.sdkVersion}>{`v${SDK_VERSION}`}</Text>
              <View style={styles.connectedPill}>
                <View style={[styles.connectedDot, { backgroundColor: connected ? COLORS.connectedDot : COLORS.textTertiary }]} />
                <Text style={styles.connectedText}>{connected ? 'Connected' : 'Offline'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>BugSplat SDK · Demo</Text>
            <View style={styles.dbBadge}>
              <Text style={styles.dbBadgeText}>{DATABASE}</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Trigger an event. We catch it, group it, route it to your dashboard.</Text>

          <Text style={[styles.sectionHeader, { marginTop: 22 }]}>TRIGGER AN EVENT</Text>

          {CARDS.map((card) => (
            <View key={card.key}>
              <Pressable
                onPress={card.disabled ? undefined : handlers[card.key]}
                disabled={card.disabled}
                style={({ pressed }) => [
                  styles.card,
                  card.disabled && styles.cardDisabled,
                  pressed && !card.disabled && styles.cardPressed,
                ]}
              >
                <Image source={card.icon} style={styles.cardIcon} resizeMode="contain" />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>
              </Pressable>
              {card.disabled && card.disabledHint && (
                <Text style={styles.cardDisabledHint}>{card.disabledHint}</Text>
              )}
            </View>
          ))}

          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionHeader}>RECENT ACTIVITY</Text>
              <Pressable onPress={onViewDashboard} hitSlop={8}>
                <Text style={styles.dashboardLink}>View dashboard ↗</Text>
              </Pressable>
            </View>

            {entries.length === 0 ? (
              <Text style={styles.emptyText}>No events yet — tap a card above to get started.</Text>
            ) : (
              entries.map((entry, idx) => (
                <View key={`${entry.timestampMs}-${idx}`} style={[styles.activityRow, idx > 0 && styles.activityRowSpacing]}>
                  <View style={[styles.activityDot, { backgroundColor: activityDotColor(entry.type) }]} />
                  <Text style={styles.activityLabel}>{activityLabel(entry.type)}</Text>
                  <Text style={styles.activityDetail} numberOfLines={1}>{entry.detail}</Text>
                  <Text style={styles.activityTime}>{formatRelativeTime(nowTick, entry.timestampMs)}</Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>{statusText}</Text>
        </ScrollView>

        <Modal visible={feedbackOpen} animationType="slide" transparent onRequestClose={() => setFeedbackOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Send Feedback</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Subject"
                placeholderTextColor={COLORS.textTertiary}
                value={feedbackTitle}
                onChangeText={setFeedbackTitle}
                autoFocus
              />
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholder="Description (optional)"
                placeholderTextColor={COLORS.textTertiary}
                value={feedbackBody}
                onChangeText={setFeedbackBody}
                multiline
              />
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setFeedbackOpen(false)} style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.modalButtonSecondary}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onSubmitFeedback}
                  disabled={!feedbackTitle.trim()}
                  style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.modalButtonPrimary, !feedbackTitle.trim() && { opacity: 0.4 }]}>Submit</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { flex: 1, backgroundColor: COLORS.screenBg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },

  topBar: { flexDirection: 'row', alignItems: 'center' },
  // Flex container takes the available space; the image inside it stays at its
  // intrinsic aspect ratio and pins to the leading edge — fixes the phantom
  // centering caused by stretching the Image itself with resizeMode=contain.
  // Explicit width (rather than aspectRatio) so RN Web doesn't stretch the
  // Image to fill flex:1 and then center the content with resizeMode=contain.
  // 78 = round(28 * 1000 / 359) — preserves the wordmark's intrinsic ratio.
  wordmarkWrap: { flex: 1, alignItems: 'flex-start' },
  wordmark: { width: 78, height: 28 },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  sdkVersion: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 10,
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.connectedBg,
    borderWidth: 1,
    borderColor: COLORS.connectedStroke,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  connectedDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connectedText: { fontSize: 12, color: COLORS.textPrimary },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  dbBadge: {
    marginLeft: 10,
    backgroundColor: COLORS.badgeBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dbBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textTertiary,
    letterSpacing: 1.5,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardStroke,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 84,
    marginTop: 12,
  },
  cardPressed: { opacity: 0.7 },
  cardDisabled: { opacity: 0.45 },
  cardDisabledHint: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  cardIcon: { width: 52, height: 52, marginRight: 16 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  cardSubtitle: { marginTop: 2, fontSize: 14, color: COLORS.textSecondary },

  recentCard: {
    marginTop: 18,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardStroke,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dashboardLink: { fontSize: 13, fontWeight: '700', color: COLORS.link },
  emptyText: { marginTop: 14, fontSize: 14, color: COLORS.textTertiary },

  activityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  activityRowSpacing: { marginTop: 10 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  activityLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginRight: 14 },
  activityDetail: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  activityTime: { fontSize: 13, color: COLORS.textTertiary, marginLeft: 10 },

  footer: { marginTop: 18, textAlign: 'center', fontSize: 13, color: COLORS.textTertiary },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.cardStroke,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  modalInputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  modalButton: { paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8 },
  modalButtonSecondary: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  modalButtonPrimary: { fontSize: 15, color: COLORS.link, fontWeight: '700' },
});
