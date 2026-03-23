#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IOS_FRAMEWORKS_DIR = path.join(__dirname, '..', 'ios', 'Frameworks');
const XCFRAMEWORK_PATH = path.join(IOS_FRAMEWORKS_DIR, 'BugSplat.xcframework');

// Follow redirects (GitHub releases use 302 redirects)
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (reqUrl) => {
      https.get(reqUrl, { headers: { 'User-Agent': 'bugsplat-expo' } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function main() {
  // iOS: Download BugSplat.xcframework if not present
  if (!fs.existsSync(XCFRAMEWORK_PATH)) {
    console.log('[bugsplat-expo] Downloading BugSplat.xcframework...');
    fs.mkdirSync(IOS_FRAMEWORKS_DIR, { recursive: true });

    const zipPath = path.join(IOS_FRAMEWORKS_DIR, 'BugSplat.xcframework.zip');
    const url = 'https://github.com/BugSplat-Git/bugsplat-apple/releases/latest/download/BugSplat.xcframework.zip';

    try {
      await download(url, zipPath);
      execSync(`unzip -o "${zipPath}" -d "${IOS_FRAMEWORKS_DIR}"`);
      fs.unlinkSync(zipPath);
      console.log('[bugsplat-expo] BugSplat.xcframework downloaded successfully.');
    } catch (err) {
      console.warn(`[bugsplat-expo] Failed to download xcframework: ${err.message}`);
      console.warn('[bugsplat-expo] iOS native crash reporting will not be available.');
    }
  }
}

main();
