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

  // Optionally add dSYM upload build phase
  if (props.enableDsymUpload) {
    config = withBugsplatDsymUpload(config, props);
  }

  return config;
};

const withBugsplatDsymUpload: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const buildPhaseComment = 'Upload dSYMs to BugSplat';

    // Check if build phase already exists
    const shellScriptPhases = project.hash.project.objects['PBXShellScriptBuildPhase'] || {};
    const alreadyExists = Object.values(shellScriptPhases).some(
      (phase: any) => typeof phase === 'object' && phase.name === JSON.stringify(buildPhaseComment)
    );

    if (!alreadyExists) {
      const clientId = props.symbolUploadClientId || '';
      const clientSecret = props.symbolUploadClientSecret || '';

      const shellScript = [
        'if [ "${CONFIGURATION}" = "Release" ]; then',
        '  SYMBOL_UPLOAD="${SRCROOT}/../node_modules/@bugsplat/expo/scripts/symbol-upload-macos"',
        '  if [ -x "$SYMBOL_UPLOAD" ]; then',
        `    "$SYMBOL_UPLOAD" \\\\`,
        `      -b "${props.database}" \\\\`,
        `      -a "\${PRODUCT_NAME}" \\\\`,
        `      -v "\${MARKETING_VERSION}" \\\\`,
        `      -i "${clientId}" \\\\`,
        `      -s "${clientSecret}" \\\\`,
        `      -d "\${DWARF_DSYM_FOLDER_PATH}" \\\\`,
        '      -f "**/*.dSYM"',
        '  else',
        '    echo "warning: symbol-upload-macos not found, skipping dSYM upload"',
        '  fi',
        'fi',
      ].join('\\n');

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
