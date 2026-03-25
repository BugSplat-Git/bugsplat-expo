export interface BugSplatPluginOptions {
  /** Enable automatic symbol upload for iOS (dSYMs) and Android (.so files) */
  enableSymbolUpload?: boolean;
  /** BugSplat API client ID for symbol upload (or set BUGSPLAT_CLIENT_ID env var) */
  symbolUploadClientId?: string;
  /** BugSplat API client secret for symbol upload (or set BUGSPLAT_CLIENT_SECRET env var) */
  symbolUploadClientSecret?: string;
  /** BugSplat database name (optional — prefer setting via init() in code) */
  database?: string;
}
