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
 * Options for manually posting an error.
 */
export interface BugSplatPostOptions {
  /** Override default app key */
  appKey?: string;
  /** Override default user */
  user?: string;
  /** Override default email */
  email?: string;
  /** Description of the error context */
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
 * Configuration passed to the config plugin via app.json / app.config.js.
 */
export interface BugSplatPluginOptions {
  /** Enable automatic dSYM upload build phase in Xcode */
  enableDsymUpload?: boolean;
  /** BugSplat API client ID for symbol upload */
  symbolUploadClientId?: string;
  /** BugSplat API client secret for symbol upload */
  symbolUploadClientSecret?: string;
  /** BugSplat database name (optional — prefer setting via init() in code) */
  database?: string;
}
