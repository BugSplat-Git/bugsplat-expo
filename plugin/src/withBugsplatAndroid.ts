import { ConfigPlugin, AndroidConfig } from 'expo/config-plugins';
import type { BugSplatPluginOptions } from './types';

export const withBugsplatAndroid: ConfigPlugin<BugSplatPluginOptions> = (config, _props) => {
  // Add required Android permissions
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ]);

  return config;
};
