export type {
  BugSplatAttachment,
  BugSplatOptions,
  BugSplatOptions as BugSplatPostOptions,
  BugSplatOptions as BugSplatFeedbackOptions,
} from '@bugsplat/react';

/**
 * Options for initializing BugSplat.
 */
export interface BugSplatInitOptions {
  /** Optional app key for additional metadata queryable in the BugSplat dashboard */
  appKey?: string;
  /** User name to associate with crash reports */
  userName?: string;
  /** User email to associate with crash reports */
  userEmail?: string;
  /** Whether to auto-submit crash reports without user prompt (iOS only, default: true) */
  autoSubmitCrashReport?: boolean;
  /** Custom key-value attributes to include with crash reports */
  attributes?: Record<string, string>;
  /** File paths for attachments (native only) */
  attachments?: string[];
  /** Additional description/notes for crash reports */
  description?: string;
}

/**
 * Result from posting an error report.
 */
export interface BugSplatPostResult {
  /** Whether the post was successful */
  success: boolean;
  /** Error message if the post failed */
  error?: string;
}

/**
 * Result from submitting user feedback.
 */
export interface BugSplatFeedbackResult {
  /** Whether the feedback submission was successful */
  success: boolean;
  /** Error message if submission failed */
  error?: string;
  /** Crash ID assigned to the feedback submission, if returned by the server */
  crashId?: number;
}

/**
 * Configuration passed to the config plugin via app.json / app.config.js.
 */
export interface BugSplatPluginOptions {
  /**
   * Enable automatic symbol upload for iOS (dSYMs) and Android (.so files).
   * When enabled, credentials must be provided via `symbolUploadClientId` /
   * `symbolUploadClientSecret` or the `BUGSPLAT_CLIENT_ID` / `BUGSPLAT_CLIENT_SECRET`
   * env vars. Requires `@bugsplat/symbol-upload` to be installed.
   */
  enableSymbolUpload?: boolean;
  /** BugSplat API client ID for symbol upload (or set BUGSPLAT_CLIENT_ID env var) */
  symbolUploadClientId?: string;
  /** BugSplat API client secret for symbol upload (or set BUGSPLAT_CLIENT_SECRET env var) */
  symbolUploadClientSecret?: string;
  /** BugSplat database name (optional — prefer setting via init() in code) */
  database?: string;
}
