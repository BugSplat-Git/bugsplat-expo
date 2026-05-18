import { ConfigPlugin, AndroidConfig, withAndroidManifest, withAppBuildGradle } from 'expo/config-plugins';
import type { BugSplatPluginOptions } from './types';

export const withBugsplatAndroid: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
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

  // Optionally add symbol upload Gradle task
  if (props.enableSymbolUpload) {
    config = withBugsplatSymbolUpload(config, props);
  }

  return config;
};

export const buildAndroidGradleTask = (props: BugSplatPluginOptions): string => {
  const clientId = props.symbolUploadClientId
    ? `"${props.symbolUploadClientId}"`
    : 'System.getenv("BUGSPLAT_CLIENT_ID") ?: ""';
  const clientSecret = props.symbolUploadClientSecret
    ? `"${props.symbolUploadClientSecret}"`
    : 'System.getenv("BUGSPLAT_CLIENT_SECRET") ?: ""';
  // Validated by the top-level withBugsplat plugin.
  const database = props.database!;

  return [
    '',
    '// BugSplat symbol upload task',
    'tasks.register("uploadBugsplatSymbols") {',
    '    doLast {',
    '        def npxCheck = ["which", "npx"].execute()',
    '        npxCheck.waitFor()',
    '        if (npxCheck.exitValue() != 0) {',
    '            logger.warn("BugSplat: npx not found — skipping symbol upload")',
    '            return',
    '        }',
    '',
    `        def bsDatabase = "${database}"`,
    `        def bsClientId = ${clientId}`,
    `        def bsClientSecret = ${clientSecret}`,
    '        if (!bsClientId || !bsClientSecret) {',
    '            logger.warn("BugSplat: client credentials not set — skipping symbol upload")',
    '            return',
    '        }',
    '',
    '        def appName = android.defaultConfig.applicationId ?: project.name',
    '        def appVersion = android.defaultConfig.versionName ?: "1.0.0"',
    '',
    '        // 1) Native .so symbols',
    '        def soDir = layout.buildDirectory.dir("intermediates/merged_native_libs").get().asFile.absolutePath',
    '        exec {',
    '            commandLine("npx", "--yes", "@bugsplat/symbol-upload",',
    '                "-b", bsDatabase,',
    '                "-a", appName,',
    '                "-v", appVersion,',
    '                "-i", bsClientId,',
    '                "-s", bsClientSecret,',
    '                "-d", soDir,',
    '                "-f", "**/*.so",',
    '                "-m"',
    '            )',
    '        }',
    '',
    '        // 2) JS source maps (RN Gradle plugin emits these in Release+Hermes)',
    '        def sourceMapDir = layout.buildDirectory.dir("generated/sourcemaps/react/release").get().asFile',
    '        def hasMaps = sourceMapDir.exists() && fileTree(sourceMapDir).matching { include "**/*.js.map", "**/*.bundle.map" }.files.size() > 0',
    '        if (hasMaps) {',
    '            exec {',
    '                commandLine("npx", "--yes", "@bugsplat/symbol-upload",',
    '                    "-b", bsDatabase,',
    '                    "-a", appName,',
    '                    "-v", appVersion,',
    '                    "-i", bsClientId,',
    '                    "-s", bsClientSecret,',
    '                    "-d", sourceMapDir.absolutePath,',
    '                    "-f", "**/*.{js,bundle}.map"',
    '                )',
    '            }',
    '        } else {',
    '            logger.warn("BugSplat: no .map files in ${sourceMapDir.absolutePath} — skipping JS source map upload")',
    '        }',
    '    }',
    '}',
    '',
    '// Auto-chain BugSplat uploads onto assembleRelease so a single Release',
    '// build emits + uploads native .so symbols and JS source maps. Debug',
    '// builds skip on purpose (creds may not be set, and dev symbols would',
    '// just flood the dashboard). tasks.matching+configureEach is the',
    '// AGP-friendly form — assembleRelease is registered as a TaskProvider',
    '// so the older whenTaskAdded hook never fires for it.',
    'tasks.matching { it.name == "assembleRelease" }.configureEach {',
    '    finalizedBy("uploadBugsplatSymbols")',
    '}',
    '',
  ].join('\n');
};

const withBugsplatSymbolUpload: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('uploadBugsplatSymbols')) {
      config.modResults.contents = contents + buildAndroidGradleTask(props);
    }
    return config;
  });
};
