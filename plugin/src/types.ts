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
  /**
   * BugSplat database name. Required — the plugin throws at prebuild if missing.
   * Acts as the single source of truth for both symbol upload and the runtime
   * `init()` call (read from app code via `expo-constants`).
   */
  database?: string;
}
