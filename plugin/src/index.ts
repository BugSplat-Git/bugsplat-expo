import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins';
import { withBugsplatIos } from './withBugsplatIos';
import { withBugsplatAndroid } from './withBugsplatAndroid';
import type { BugSplatPluginOptions } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

const withBugsplat: ConfigPlugin<BugSplatPluginOptions | void> = (config, props) => {
  const options: BugSplatPluginOptions = props ?? {};

  const database = options.database?.trim();
  if (!database) {
    throw new Error(
      '@bugsplat/expo: "database" is required. Set it under the plugin entry in app.json, e.g.\n' +
      '  "plugins": [["@bugsplat/expo", { "database": "my-bugsplat-db" }]]'
    );
  }
  // Reject angle-bracket placeholders like "<your-database>" — these are sentinel
  // values shipped in the sample app.json to force consumers to override them.
  if (/^<.*>$/.test(database)) {
    throw new Error(
      `@bugsplat/expo: "database" is set to the placeholder ${JSON.stringify(database)}. ` +
      'Replace it with your real BugSplat database name in app.json under the plugin config.'
    );
  }
  // Write the trimmed value back so the same normalized string flows into
  // Info.plist (iOS), the Gradle task (Android), and any runtime read of
  // the plugin config. Without this, "  my-db  " would pass validation but
  // be embedded verbatim, targeting the wrong BugSplat database.
  options.database = database;

  // Both platforms read the version from app code via expo.version.
  if (!config.version) {
    throw new Error(
      '@bugsplat/expo: app.json "expo.version" is required — it becomes the BugSplat application version.'
    );
  }
  // iOS symbol upload sends PRODUCT_NAME (derived from expo.name).
  if (!config.name) {
    throw new Error(
      '@bugsplat/expo: app.json "expo.name" is required — it becomes the BugSplat application name on iOS.'
    );
  }
  // Android symbol upload sends applicationId (= expo.android.package).
  if (!config.android?.package) {
    throw new Error(
      '@bugsplat/expo: app.json "expo.android.package" is required — it becomes the BugSplat application name on Android.'
    );
  }

  if (options.enableSymbolUpload) {
    const clientId = options.symbolUploadClientId ?? process.env.BUGSPLAT_CLIENT_ID;
    const clientSecret = options.symbolUploadClientSecret ?? process.env.BUGSPLAT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        '@bugsplat/expo: enableSymbolUpload is true but credentials are missing. ' +
        'Provide symbolUploadClientId / symbolUploadClientSecret in app.json, ' +
        'or set the BUGSPLAT_CLIENT_ID / BUGSPLAT_CLIENT_SECRET env vars.'
      );
    }
  }

  config = withBugsplatIos(config, options);
  config = withBugsplatAndroid(config, options);
  return config;
};

export default createRunOncePlugin(withBugsplat, pkg.name, pkg.version);
