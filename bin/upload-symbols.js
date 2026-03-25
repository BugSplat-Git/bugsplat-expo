#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const USAGE = `Usage: npx @bugsplat/expo upload-symbols [options]

Upload debug symbols to BugSplat for symbolicated crash reports.

Options:
  --platform <ios|android>   Platform to upload symbols for (default: both)
  --database <name>          BugSplat database name (or set BUGSPLAT_DATABASE)
  --application <name>       Application name (default: from app.json)
  --version <version>        Application version (default: from app.json)
  --client-id <id>           OAuth2 client ID (or set BUGSPLAT_CLIENT_ID)
  --client-secret <secret>   OAuth2 client secret (or set BUGSPLAT_CLIENT_SECRET)
  --directory <path>         Custom symbol directory to search
  --help                     Show this help message
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--platform':
        args.platform = argv[++i];
        break;
      case '--database':
      case '-b':
        args.database = argv[++i];
        break;
      case '--application':
      case '-a':
        args.application = argv[++i];
        break;
      case '--version':
      case '-v':
        args.version = argv[++i];
        break;
      case '--client-id':
      case '-i':
        args.clientId = argv[++i];
        break;
      case '--client-secret':
      case '-s':
        args.clientSecret = argv[++i];
        break;
      case '--directory':
      case '-d':
        args.directory = argv[++i];
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        if (argv[i] === 'upload-symbols') break;
        console.error(`Unknown option: ${argv[i]}`);
        console.log(USAGE);
        process.exit(1);
    }
  }
  return args;
}

function loadAppConfig() {
  const configPaths = [
    path.resolve('app.json'),
    path.resolve('app.config.json'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return raw.expo || raw;
      } catch {
        // continue to next
      }
    }
  }

  return {};
}

function findBugsplatPluginConfig(appConfig) {
  const plugins = appConfig.plugins || [];
  for (const plugin of plugins) {
    if (Array.isArray(plugin) && plugin[0] === '@bugsplat/expo') {
      return plugin[1] || {};
    }
  }
  return {};
}

function findIosSymbolDir() {
  const derivedData = path.join(
    process.env.HOME || '~',
    'Library/Developer/Xcode/DerivedData'
  );

  if (!fs.existsSync(derivedData)) return null;

  // Look for Build/Products directories with dSYMs
  try {
    const projects = fs.readdirSync(derivedData);
    for (const project of projects.reverse()) {
      const productsDir = path.join(derivedData, project, 'Build', 'Products');
      if (fs.existsSync(productsDir)) {
        const releaseDir = path.join(productsDir, 'Release-iphoneos');
        if (fs.existsSync(releaseDir)) return releaseDir;
      }
    }
  } catch {
    // fall through
  }

  return null;
}

function findAndroidSymbolDir() {
  const candidates = [
    path.resolve('android/app/build/intermediates/merged_native_libs'),
    path.resolve('android/app/build/intermediates/stripped_native_libs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function runUpload({ database, application, version, clientId, clientSecret, directory, filePattern, dumpSyms }) {
  const args = [
    '@bugsplat/symbol-upload',
    '-b', database,
    '-a', application,
    '-v', version,
    '-i', clientId,
    '-s', clientSecret,
    '-d', directory,
    '-f', filePattern,
  ];

  if (dumpSyms) {
    args.push('-m');
  }

  // Log the command with credentials redacted
  const redactedArgs = args.map((a, i) => {
    const prev = args[i - 1];
    if (prev === '-i' || prev === '-s') return '"***"';
    return `"${a}"`;
  });
  console.log(`Running: npx ${redactedArgs.join(' ')}`);

  try {
    execFileSync('npx', args, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Symbol upload failed: ${error.message}`);
    return false;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const appConfig = loadAppConfig();
  const pluginConfig = findBugsplatPluginConfig(appConfig);

  const database = args.database || process.env.BUGSPLAT_DATABASE || pluginConfig.database || '';
  const application = args.application || appConfig.name || '';
  const version = args.version || appConfig.version || '1.0.0';
  const clientId = args.clientId || process.env.BUGSPLAT_CLIENT_ID || pluginConfig.symbolUploadClientId || '';
  const clientSecret = args.clientSecret || process.env.BUGSPLAT_CLIENT_SECRET || pluginConfig.symbolUploadClientSecret || '';

  if (!database) {
    console.error('Error: database is required. Set --database, BUGSPLAT_DATABASE env var, or configure in app.json plugin options.');
    process.exit(1);
  }

  if (!clientId || !clientSecret) {
    console.error('Error: client ID and secret are required. Use --client-id/--client-secret, BUGSPLAT_CLIENT_ID/BUGSPLAT_CLIENT_SECRET env vars, or configure in app.json plugin options.');
    process.exit(1);
  }

  const platforms = args.platform ? [args.platform] : ['ios', 'android'];
  let success = true;

  for (const platform of platforms) {
    console.log(`\nUploading ${platform} symbols...`);

    if (platform === 'ios') {
      const directory = args.directory || findIosSymbolDir();
      if (!directory) {
        console.error('Could not find iOS build output. Use --directory to specify the dSYM path.');
        success = false;
        continue;
      }
      if (!runUpload({ database, application, version, clientId, clientSecret, directory, filePattern: '**/*.dSYM', dumpSyms: false })) {
        success = false;
      }
    } else if (platform === 'android') {
      const directory = args.directory || findAndroidSymbolDir();
      if (!directory) {
        console.error('Could not find Android build output. Use --directory to specify the .so files path.');
        success = false;
        continue;
      }
      if (!runUpload({ database, application, version, clientId, clientSecret, directory, filePattern: '**/*.so', dumpSyms: true })) {
        success = false;
      }
    } else {
      console.error(`Unknown platform: ${platform}. Use "ios" or "android".`);
      success = false;
    }
  }

  process.exit(success ? 0 : 1);
}

main();
