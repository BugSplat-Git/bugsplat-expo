import { ConfigPlugin, withInfoPlist, withXcodeProject } from 'expo/config-plugins';
import type { BugSplatPluginOptions } from './types';

export const withBugsplatIos: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  // Only set BugSplatDatabase in Info.plist if explicitly provided
  if (props.database) {
    config = withInfoPlist(config, (config) => {
      config.modResults.BugSplatDatabase = props.database;
      return config;
    });
  }

  // Optionally add symbol upload build phase
  if (props.enableSymbolUpload) {
    config = withBugsplatSymbolUpload(config, props);
  }

  return config;
};

export const buildIosUploadScript = (props: BugSplatPluginOptions): string => {
  const clientId = props.symbolUploadClientId || '${BUGSPLAT_CLIENT_ID}';
  const clientSecret = props.symbolUploadClientSecret || '${BUGSPLAT_CLIENT_SECRET}';
  const database = props.database || '${BUGSPLAT_DATABASE}';

  return [
    'if [ "${CONFIGURATION}" = "Release" ]; then',
    `  npx @bugsplat/symbol-upload \\\\`,
    `    -b "${database}" \\\\`,
    `    -a "\${PRODUCT_NAME}" \\\\`,
    `    -v "\${MARKETING_VERSION}" \\\\`,
    `    -i "${clientId}" \\\\`,
    `    -s "${clientSecret}" \\\\`,
    `    -d "\${DWARF_DSYM_FOLDER_PATH}" \\\\`,
    '    -f "**/*.dSYM"',
    'fi',
  ].join('\\n');
};

const withBugsplatSymbolUpload: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const buildPhaseComment = 'Upload symbols to BugSplat';

    // Check if build phase already exists
    const shellScriptPhases = project.hash.project.objects['PBXShellScriptBuildPhase'] || {};
    const alreadyExists = Object.values(shellScriptPhases).some(
      (phase: any) => typeof phase === 'object' && phase.name === JSON.stringify(buildPhaseComment)
    );

    if (!alreadyExists) {
      const shellScript = buildIosUploadScript(props);

      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        buildPhaseComment,
        project.getFirstTarget().uuid,
        { shellPath: '/bin/sh', shellScript }
      );
    }

    return config;
  });
};
