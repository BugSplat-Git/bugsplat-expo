import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins';
import { withBugsplatIos } from './withBugsplatIos';
import { withBugsplatAndroid } from './withBugsplatAndroid';
import type { BugSplatPluginOptions } from './types';

const pkg = require('bugsplat-expo/package.json');

const withBugsplat: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  if (!props?.database) {
    throw new Error(
      'bugsplat-expo config plugin requires a "database" property. ' +
      'Example: ["bugsplat-expo", { "database": "your-database" }]'
    );
  }

  config = withBugsplatIos(config, props);
  config = withBugsplatAndroid(config, props);
  return config;
};

export default createRunOncePlugin(withBugsplat, pkg.name, pkg.version);
