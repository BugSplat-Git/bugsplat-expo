export interface BugSplatPluginOptions {
  /** BugSplat database name (required — sets BugSplatDatabase in Info.plist) */
  database: string;
  /** Enable automatic dSYM upload build phase in Xcode */
  enableDsymUpload?: boolean;
  /** BugSplat API client ID for symbol upload */
  symbolUploadClientId?: string;
  /** BugSplat API client secret for symbol upload */
  symbolUploadClientSecret?: string;
}
