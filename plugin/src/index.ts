import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins';
import { withBugsplatIos } from './withBugsplatIos';
import { withBugsplatAndroid } from './withBugsplatAndroid';
import type { BugSplatPluginOptions } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

const withBugsplat: ConfigPlugin<BugSplatPluginOptions | void> = (config, props) => {
  const options: BugSplatPluginOptions = props ?? {};
  config = withBugsplatIos(config, options);
  config = withBugsplatAndroid(config, options);
  return config;
};

export default createRunOncePlugin(withBugsplat, pkg.name, pkg.version);
