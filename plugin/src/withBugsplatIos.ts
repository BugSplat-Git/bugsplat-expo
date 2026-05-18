import { ConfigPlugin, withInfoPlist, withXcodeProject } from 'expo/config-plugins';
import type { BugSplatPluginOptions } from './types';

const BUILD_PHASE_NAME = 'Upload symbols to BugSplat';

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
  // Validated by the top-level withBugsplat plugin.
  const database = props.database!;

  return [
    'if [ "${CONFIGURATION}" = "Release" ]; then',
    '  if ! command -v npx &> /dev/null; then',
    '    echo "warning: npx not found — skipping BugSplat symbol upload"',
    '    exit 0',
    '  fi',
    `  CLIENT_ID="${clientId}"`,
    `  CLIENT_SECRET="${clientSecret}"`,
    '  if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then',
    '    echo "warning: BugSplat client credentials not set — skipping symbol upload"',
    '    exit 0',
    '  fi',
    '  # 1) Native dSYMs',
    `  npx --yes @bugsplat/symbol-upload \\\\`,
    `    -b "${database}" \\\\`,
    `    -a "\${PRODUCT_NAME}" \\\\`,
    `    -v "\${MARKETING_VERSION}" \\\\`,
    `    -i "$CLIENT_ID" \\\\`,
    `    -s "$CLIENT_SECRET" \\\\`,
    `    -d "\${DWARF_DSYM_FOLDER_PATH}" \\\\`,
    '    -f "**/*.dSYM"',
    '',
    '  # 2) JS source maps (requires SOURCEMAP_FILE during the bundle phase;',
    '  # Expo emits the map alongside main.jsbundle when configured)',
    '  if ls "${DERIVED_FILE_DIR}"/*.map 1>/dev/null 2>&1; then',
    `    npx --yes @bugsplat/symbol-upload \\\\`,
    `      -b "${database}" \\\\`,
    `      -a "\${PRODUCT_NAME}" \\\\`,
    `      -v "\${MARKETING_VERSION}" \\\\`,
    `      -i "$CLIENT_ID" \\\\`,
    `      -s "$CLIENT_SECRET" \\\\`,
    `      -d "\${DERIVED_FILE_DIR}" \\\\`,
    '      -f "**/*.map"',
    '  else',
    '    echo "warning: BugSplat — no .map files found in ${DERIVED_FILE_DIR}; skipping JS source map upload."',
    '    echo "  Set SOURCEMAP_FILE in your bundle build phase to enable JS symbolication."',
    '  fi',
    'fi',
  ].join('\\n');
};

const withBugsplatSymbolUpload: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const shellScriptPhases = project.hash.project.objects['PBXShellScriptBuildPhase'] || {};

    const alreadyExists = Object.values(shellScriptPhases).some(
      (phase: any) =>
        typeof phase === 'object' && phase.name === JSON.stringify(BUILD_PHASE_NAME)
    );

    if (!alreadyExists) {
      const shellScript = buildIosUploadScript(props);

      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        BUILD_PHASE_NAME,
        project.getFirstTarget().uuid,
        { shellPath: '/bin/sh', shellScript }
      );
    }

    return config;
  });
};
