import { postFeedback, type BugSplatAttachment } from '@bugsplat/expo';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildLogAttachment, pickFile as openFilePicker } from './attachments';
import type { PickedFile } from './attachments.types';
import { COLORS } from './theme';

type Category = 'Bug' | 'Feature' | 'Other';
const CATEGORIES: Category[] = ['Bug', 'Feature', 'Other'];

export interface FeedbackSheetProps {
  /** Whether the sheet is shown. State resets each time this flips to true. */
  visible: boolean;
  /** Dismiss the sheet (close control, backdrop tap, Android back, Close button). */
  onClose: () => void;
  /** Called once after a successful submit so the host can log activity. */
  onSubmitted: (title: string) => void;
  database: string;
  appName: string;
  appVersion: string;
  sdkVersion: string;
}

/** Human-readable byte size, e.g. "287 KB" / "1.2 MB". */
function formatBytes(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short type label for the attachment chip, e.g. "PNG" / "TXT" / "FILE". */
function fileKind(file: PickedFile): string {
  const ext = file.name.match(/\.([a-z0-9]+)$/i);
  if (ext) return ext[1].toUpperCase();
  if (file.mimeType) {
    const parts = file.mimeType.split('/');
    return (parts[1] || parts[0] || 'file').toUpperCase().slice(0, 4);
  }
  return 'FILE';
}

/**
 * A made-up diagnostic log, stitched together from real app/SDK/device
 * metadata plus synthetic log lines. This stands in for the "include logs"
 * option in a way that's safe for a public sample app — there are no real
 * device logs to leak.
 */
function buildDemoLog(p: Pick<FeedbackSheetProps, 'appName' | 'appVersion' | 'sdkVersion' | 'database'>): string {
  return [
    '=== BugSplat Expo Demo — diagnostic log ===',
    `generated: ${new Date().toISOString()}`,
    `app:       ${p.appName} v${p.appVersion}`,
    `sdk:       @bugsplat/expo v${p.sdkVersion}`,
    `platform:  ${Platform.OS} ${Platform.Version}`,
    `database:  ${p.database}`,
    '',
    '[10:42:01.004] INFO  App launched',
    `[10:42:01.118] INFO  BugSplat.init() ok (database=${p.database})`,
    '[10:42:03.552] DEBUG Accelerometer listener attached (shake-to-feedback)',
    '[10:42:09.871] INFO  User opened the feedback sheet',
    '[10:42:12.339] WARN  Sample warning: cache miss for key "demo"',
    '[10:42:12.340] INFO  Feedback attachment prepared',
    '=== end of log ===',
    '',
  ].join('\n');
}

export function FeedbackSheet(props: FeedbackSheetProps) {
  const { visible, onClose, onSubmitted, database, appName, appVersion, sdkVersion } = props;
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'form' | 'thanks'>('form');
  const [category, setCategory] = useState<Category>('Bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [crashId, setCrashId] = useState<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  // Reset to a clean form every time the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    setPhase('form');
    setCategory('Bug');
    setTitle('');
    setDescription('');
    setName('');
    setEmail('');
    setFile(null);
    setIncludeLogs(true);
    setSubmitting(false);
    setTitleInvalid(false);
    setErrorText(null);
    setCrashId(undefined);
    setCopied(false);
  }, [visible]);

  const pickFile = async () => {
    try {
      const picked = await openFilePicker();
      if (picked) setFile(picked);
    } catch (e) {
      console.warn('[BugSplat] file pick failed:', e);
    }
  };

  const onSend = async () => {
    if (submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleInvalid(true);
      return;
    }
    setSubmitting(true);
    setErrorText(null);

    try {
      const attachments: BugSplatAttachment[] = [];
      if (file) attachments.push(file.attachment);
      if (includeLogs) {
        attachments.push(
          buildLogAttachment(
            'bugsplat-demo-log.txt',
            buildDemoLog({ appName, appVersion, sdkVersion, database })
          )
        );
      }

      const result = await postFeedback(trimmedTitle, {
        description: description.trim() || undefined,
        user: name.trim() || undefined,
        email: email.trim() || undefined,
        attributes: { category },
        attachments,
      });
      if (result.success) {
        setCrashId(result.crashId);
        setPhase('thanks');
        onSubmitted(trimmedTitle);
      } else {
        // Stay on the form with all input intact so the user can retry.
        setErrorText(result.error ?? 'Something went wrong. Please try again.');
      }
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onCopyId = async () => {
    if (crashId == null) return;
    try {
      await Clipboard.setStringAsync(String(crashId));
      setCopied(true);
    } catch (e) {
      console.warn('[BugSplat] copy failed:', e);
    }
  };

  const onViewDashboard = () => {
    // Link straight to the report by id. Feedback reports group by their
    // (unique) title, so the SDK's infoUrl would resolve to a generic page —
    // fall back to the database dashboard only when there's no id.
    const url = crashId != null
      ? `https://app.bugsplat.com/v2/crash?database=${encodeURIComponent(database)}&id=${crashId}`
      : `https://app.bugsplat.com/v2/dashboard?database=${encodeURIComponent(database)}`;
    Linking.openURL(url).catch(() => {});
  };

  const triggerHint =
    Platform.OS === 'web'
      ? 'Triggered from the User Feedback card.'
      : 'Triggered by shaking the device.';

  const titleMissing = !title.trim();
  const footerPad = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {phase === 'form' ? (
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Send feedback</Text>
                <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                  <Text style={styles.closeIcon}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Category selector */}
                <View style={styles.segment}>
                  {CATEGORIES.map((c) => {
                    const active = c === category;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        style={[styles.segmentItem, active && styles.segmentItemActive]}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Title (required) */}
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    Title<Text style={styles.asterisk}> *</Text>
                  </Text>
                </View>
                <TextInput
                  style={[styles.input, titleInvalid && styles.inputInvalid]}
                  placeholder="Short summary of your feedback"
                  placeholderTextColor={COLORS.textTertiary}
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    if (titleInvalid) setTitleInvalid(false);
                  }}
                />
                {titleInvalid && <Text style={styles.fieldError}>Title is required.</Text>}

                {/* Description */}
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Description</Text>
                  <Text style={styles.optional}>optional</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="What happened? What did you expect?"
                  placeholderTextColor={COLORS.textTertiary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                {/* Name */}
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.optional}>optional</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={name}
                  onChangeText={setName}
                />

                {/* Email */}
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.optional}>optional</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Attachment */}
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Attachment</Text>
                  <Text style={styles.optional}>optional</Text>
                </View>
                {file ? (
                  <View style={styles.attachmentBox}>
                    <View style={styles.fileChip}>
                      <Text style={styles.fileChipText}>{fileKind(file)}</Text>
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.fileMeta}>{formatBytes(file.size)}</Text>
                    </View>
                    <Pressable onPress={pickFile} hitSlop={8}>
                      <Text style={styles.replaceText}>Replace</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={pickFile}
                    style={({ pressed }) => [styles.attachmentEmpty, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.attachmentEmptyText}>+ Add a file</Text>
                  </Pressable>
                )}

                {/* Include logs */}
                <View style={styles.logsRow}>
                  <View style={styles.logsTextWrap}>
                    <Text style={styles.label}>Include logs</Text>
                    <Text style={styles.logsHint}>Attach a diagnostic log file</Text>
                  </View>
                  <Switch
                    value={includeLogs}
                    onValueChange={setIncludeLogs}
                    trackColor={{ true: COLORS.primary, false: COLORS.cardStroke }}
                  />
                </View>

                {errorText && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{errorText}</Text>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={[styles.footer, { paddingBottom: footerPad }]}>
                <Text style={styles.footerHint}>{triggerHint}</Text>
                <Pressable
                  onPress={onSend}
                  disabled={submitting || titleMissing}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (submitting || titleMissing) && styles.primaryButtonDisabled,
                    pressed && !submitting && !titleMissing && styles.primaryButtonPressed,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send feedback  →</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            /* Thank-you confirmation */
            <View style={[styles.thanks, { paddingBottom: footerPad }]}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.thanksTitle}>Feedback sent. Thanks!</Text>
              <Text style={styles.thanksMessage}>
                Your note made it to the BugSplat team. We reply within a day.
              </Text>

              <View style={styles.reportRow}>
                <View style={styles.reportLeft}>
                  <Text style={styles.reportLabel}>REPORT ID</Text>
                  <Text style={styles.reportId}>
                    {crashId != null ? String(crashId) : 'unavailable'}
                  </Text>
                </View>
                {crashId != null && (
                  <Pressable
                    onPress={onCopyId}
                    style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={onViewDashboard}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.thanksPrimary,
                  pressed && styles.primaryButtonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>View on dashboard  ↗</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>

              <Text style={styles.poweredBy}>
                Powered by{' '}
                <Text
                  style={styles.poweredByLink}
                  onPress={() => Linking.openURL('https://bugsplat.com').catch(() => {})}
                >
                  BugSplat
                </Text>
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardStroke,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  closeIcon: { fontSize: 18, color: COLORS.textSecondary },

  formScroll: { flexShrink: 1 },
  formContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.badgeBg,
    borderRadius: 10,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: COLORS.cardBg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  segmentTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 6,
  },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  asterisk: { color: COLORS.asterisk, fontWeight: '700' },
  optional: { fontSize: 13, color: COLORS.textTertiary },

  input: {
    borderWidth: 1,
    borderColor: COLORS.cardStroke,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inputMultiline: { minHeight: 90, paddingTop: 11, textAlignVertical: 'top' },
  inputInvalid: { borderColor: COLORS.asterisk },
  fieldError: { marginTop: 6, fontSize: 13, color: COLORS.asterisk },

  attachmentEmpty: {
    borderWidth: 1,
    borderColor: COLORS.cardStroke,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  attachmentEmptyText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardStroke,
    borderRadius: 10,
    padding: 10,
  },
  fileChip: {
    width: 44,
    height: 36,
    borderRadius: 6,
    backgroundColor: COLORS.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  fileMeta: { marginTop: 2, fontSize: 13, color: COLORS.textTertiary },
  replaceText: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginLeft: 12 },

  logsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  logsTextWrap: { flex: 1, marginRight: 12 },
  logsHint: { marginTop: 2, fontSize: 13, color: COLORS.textTertiary },

  errorBanner: {
    marginTop: 16,
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: { fontSize: 13, color: COLORS.asterisk },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: COLORS.badgeBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardStroke,
  },
  footerHint: {
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.textTertiary,
    marginBottom: 12,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: { backgroundColor: COLORS.primaryPressed },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Thank-you screen
  thanks: { paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },
  checkCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.checkBg,
    borderWidth: 2,
    borderColor: COLORS.checkBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 36, color: COLORS.primary, fontWeight: '700' },
  thanksTitle: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  thanksMessage: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 22,
    backgroundColor: COLORS.badgeBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  reportLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTertiary,
    letterSpacing: 1,
    marginRight: 12,
  },
  reportId: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  copyButton: {
    borderWidth: 1,
    borderColor: COLORS.connectedStroke,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  copyButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },

  thanksPrimary: { alignSelf: 'stretch', marginTop: 22 },
  closeButton: { paddingVertical: 14 },
  closeButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },

  poweredBy: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textTertiary,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardStroke,
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingTop: 14,
  },
  poweredByLink: { color: COLORS.link, fontWeight: '600' },
});
