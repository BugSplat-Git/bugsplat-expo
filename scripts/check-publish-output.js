// Refuse to publish without compiled output: 0.8.0 shipped with no build/ or plugin/build/
// because expo-module-scripts 56's prepublishOnly cleans, then rebuilds incrementally.
const fs = require('fs');

const required = ['build/index.js', 'build/index.d.ts', 'plugin/build/index.js'];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error(`Refusing to publish: missing ${missing.join(', ')}`);
  process.exit(1);
}
