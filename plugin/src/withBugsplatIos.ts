import { ConfigPlugin, withDangerousMod, withInfoPlist, withXcodeProject } from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
import type { BugSplatPluginOptions } from './types';

const BUILD_PHASE_NAME = 'Upload symbols to BugSplat';
const SOURCEMAP_MARKER = '# BugSplat: SOURCEMAP_FILE for JS symbolication';
// Where Expo's bundle phase writes the composed Hermes source map. Anchored to
// PROJECT_DIR (= the ios/ directory) because that variable is stable across all
// build phases — DERIVED_FILE_DIR isn't (each phase can resolve it to a
// different DerivedSources subdir), and CONFIGURATION_BUILD_DIR collides with
// react-native-xcode.sh's PACKAGER_SOURCEMAP_FILE intermediate (which then
// gets rm'd after compose, taking our output with it).
const SOURCEMAP_DIR = '${PROJECT_DIR}/.bugsplat-sourcemaps';
const SOURCEMAP_FILE_PATH = `${SOURCEMAP_DIR}/main.jsbundle.map`;

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
    config = withSourcemapEnv(config);
    config = withBugsplatSymbolUpload(config, props);
  }

  return config;
};

// Append SOURCEMAP_FILE export to ios/.xcode.env, which the bundle phase
// sources at the top of its script. Going through .xcode.env (rather than a
// build setting) guarantees the export reaches Expo's react-native-xcode.sh
// regardless of phase-local env scoping quirks. mkdir -p ensures
// compose-source-maps.js doesn't fail trying to write into a missing dir.
const withSourcemapEnv: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const envPath = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env');
      const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (existing.includes(SOURCEMAP_MARKER)) return cfg;
      const block = [
        '',
        SOURCEMAP_MARKER,
        `mkdir -p "${SOURCEMAP_DIR}"`,
        `export SOURCEMAP_FILE="${SOURCEMAP_FILE_PATH}"`,
        '',
      ].join('\n');
      fs.writeFileSync(envPath, existing + block);
      return cfg;
    },
  ]);
};

export const buildIosUploadScript = (
  props: BugSplatPluginOptions,
  appName: string,
  appVersion: string
): string => {
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
    `    -a "${appName}" \\\\`,
    `    -v "${appVersion}" \\\\`,
    `    -i "$CLIENT_ID" \\\\`,
    `    -s "$CLIENT_SECRET" \\\\`,
    `    -d "\${DWARF_DSYM_FOLDER_PATH}" \\\\`,
    '    -f "**/*.dSYM"',
    '',
    '  # 2) JS source maps — Expo writes the composed Hermes map here',
    '  # via the SOURCEMAP_FILE export injected into .xcode.env by the plugin.',
    '  # Use a single *.map glob: bash leaves unmatched literal patterns when',
    '  # multiple are passed to ls, which makes the check spuriously fail even',
    '  # when one pattern matches. The dir is dedicated to JS maps, so no need',
    '  # to filter by .js.map vs .jsbundle.map.',
    `  SOURCEMAP_DIR="\${PROJECT_DIR}/.bugsplat-sourcemaps"`,
    '  if ls "${SOURCEMAP_DIR}"/*.map 1>/dev/null 2>&1; then',
    `    npx --yes @bugsplat/symbol-upload \\\\`,
    `      -b "${database}" \\\\`,
    `      -a "${appName}" \\\\`,
    `      -v "${appVersion}" \\\\`,
    `      -i "$CLIENT_ID" \\\\`,
    `      -s "$CLIENT_SECRET" \\\\`,
    `      -d "$SOURCEMAP_DIR" \\\\`,
    '      -f "**/*.map"',
    '  else',
    '    echo "warning: BugSplat — no JS source maps in ${SOURCEMAP_DIR}; skipping upload."',
    '    echo "  Expected the bundle phase to write main.jsbundle.map here via SOURCEMAP_FILE."',
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
      // Use literal expo.name / expo.version so the upload identity matches
      // what App.tsx passes into init(). PRODUCT_NAME / MARKETING_VERSION
      // would diverge from expo.name when Xcode strips spaces / special chars.
      const shellScript = buildIosUploadScript(props, config.name!, config.version!);

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
