import { ConfigPlugin, AndroidConfig, withAndroidManifest } from 'expo/config-plugins';
import type { BugSplatPluginOptions } from './types';

export const withBugsplatAndroid: ConfigPlugin<BugSplatPluginOptions> = (config, _props) => {
  // Add required Android permissions
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ]);

  // Crashpad's handler process (libcrashpad_handler.so) must be extracted to disk
  // so it can be executed as a separate process. Without this, native crash uploads fail.
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:extractNativeLibs'] = 'true';
    }
    return config;
  });

  return config;
};
