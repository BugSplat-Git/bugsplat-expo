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
