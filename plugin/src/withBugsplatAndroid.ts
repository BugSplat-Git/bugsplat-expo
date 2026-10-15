import {
  ConfigPlugin,
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
} from 'expo/config-plugins';
import type { BugSplatPluginOptions } from './types';

export const withBugsplatAndroid: ConfigPlugin<BugSplatPluginOptions> = (config, props) => {
  // Add required Android permissions
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ]);

  // Crashpad's handler process (libcrashpad_handler.so) must be extracted to disk
  // so it can be executed as a separate process. Without this, native crash uploads fail.
  //
  // Legacy JNI packaging extracts it. We set that through the Gradle build rather
  // than android:extractNativeLibs="true" in the manifest, because AGP on Expo
  // SDK 58 fails the build on the manifest attribute. Expo's app/build.gradle
  // template reads `expo.useLegacyPackaging` into
  // packagingOptions.jniLibs.useLegacyPackaging (the same property
  // expo-build-properties' `android.useLegacyPackaging` writes).
  config = withGradleProperties(config, (config) => {
    config.modResults = setLegacyPackagingProperty(config.modResults);
    return config;
  });

  // Plugin versions up to 0.7.0 wrote android:extractNativeLibs="true", which
  // persists in a committed android/ directory and still fails the AGP build.
  // Legacy packaging above extracts the libraries the same way, so remove it.
  // Any other value is left alone.
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application?.$?.['android:extractNativeLibs'] === 'true') {
      delete application.$['android:extractNativeLibs'];
    }
    return config;
  });

  // Optionally add symbol upload Gradle task
  if (props.enableSymbolUpload) {
    config = withBugsplatSymbolUpload(config, props);
  }

  return config;
};

export const LEGACY_PACKAGING_PROPERTY = 'expo.useLegacyPackaging';

// Sets expo.useLegacyPackaging=true, replacing an existing entry (the Expo
// template ships `expo.useLegacyPackaging=false`) rather than appending a duplicate.
export const setLegacyPackagingProperty = (
  properties: AndroidConfig.Properties.PropertiesItem[]
): AndroidConfig.Properties.PropertiesItem[] => {
  let found = false;
  const updated = properties.map((item) => {
    if (item.type === 'property' && item.key === LEGACY_PACKAGING_PROPERTY) {
      found = true;
      return { ...item, value: 'true' };
    }
    return item;
  });
  if (!found) {
    updated.push({ type: 'property', key: LEGACY_PACKAGING_PROPERTY, value: 'true' });
  }
  return updated;
};

export const buildAndroidGradleTask = (props: BugSplatPluginOptions): string => {
  // Defensive validation: this helper is exported and may be called directly
  // (e.g. from tests) without going through the top-level plugin's validation,
  // so a missing/blank database would otherwise produce an embedded literal
  // `"undefined"` and a broken Gradle task.
  const database = typeof props.database === 'string' ? props.database.trim() : '';
  if (!database) {
    throw new Error('buildAndroidGradleTask: "database" is required');
  }
  const clientId = props.symbolUploadClientId
    ? `"${props.symbolUploadClientId}"`
    : 'System.getenv("BUGSPLAT_CLIENT_ID") ?: ""';
  const clientSecret = props.symbolUploadClientSecret
    ? `"${props.symbolUploadClientSecret}"`
    : 'System.getenv("BUGSPLAT_CLIENT_SECRET") ?: ""';

  return [
    '',
    '// BugSplat symbol upload task. Gradle 9 removed Project.exec(Closure)',
    '// and tightened Task→Project delegation, so we use pure-JDK ProcessBuilder',
    '// instead and capture project-scoped values at configuration time.',
    'tasks.register("uploadBugsplatSymbols") {',
    '    // Configuration-time captures — closed over by doLast below.',
    '    def appName = android.defaultConfig.applicationId ?: project.name',
    '    def appVersion = android.defaultConfig.versionName ?: "1.0.0"',
    '    def soDir = project.layout.buildDirectory.dir("intermediates/merged_native_libs").get().asFile.absolutePath',
    '    def sourceMapDir = project.layout.buildDirectory.dir("generated/sourcemaps/react/release").get().asFile',
    '',
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
    '        def runUpload = { List<String> cmd, String label ->',
    '            logger.lifecycle("BugSplat: uploading ${label}…")',
    '            def pb = new ProcessBuilder(cmd)',
    '            pb.inheritIO()',
    '            def proc = pb.start()',
    '            def code = proc.waitFor()',
    '            if (code != 0) {',
    '                throw new GradleException("BugSplat ${label} upload failed (exit ${code})")',
    '            }',
    '        }',
    '',
    '        // 1) Native .so symbols',
    '        runUpload([',
    '            "npx", "--yes", "@bugsplat/symbol-upload",',
    '            "-b", bsDatabase,',
    '            "-a", appName,',
    '            "-v", appVersion,',
    '            "-i", bsClientId,',
    '            "-s", bsClientSecret,',
    '            "-d", soDir,',
    '            "-f", "**/*.so",',
    '            "-m"',
    '        ], "native symbols")',
    '',
    '        // 2) JS source maps (RN Gradle plugin emits these in Release+Hermes)',
    '        def hasMaps = false',
    '        if (sourceMapDir.exists()) {',
    '            sourceMapDir.eachFileRecurse(groovy.io.FileType.FILES) { f ->',
    '                if (f.name.endsWith(".js.map") || f.name.endsWith(".bundle.map")) hasMaps = true',
    '            }',
    '        }',
    '        if (hasMaps) {',
    '            runUpload([',
    '                "npx", "--yes", "@bugsplat/symbol-upload",',
    '                "-b", bsDatabase,',
    '                "-a", appName,',
    '                "-v", appVersion,',
    '                "-i", bsClientId,',
    '                "-s", bsClientSecret,',
    '                "-d", sourceMapDir.absolutePath,',
    '                "-f", "**/*.{js,bundle}.map"',
    '            ], "JS source maps")',
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
