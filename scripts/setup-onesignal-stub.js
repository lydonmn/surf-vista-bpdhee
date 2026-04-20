const fs = require('fs');
const path = require('path');
const stubDir = path.resolve(__dirname, '../stubs/onesignal');
const dest = path.join(stubDir, 'package.json');

// Try pkg.json first (committed, always present), then package.json.txt as fallback
const candidates = [
  path.join(stubDir, 'pkg.json'),
  path.join(stubDir, 'package.json.txt'),
];

let src = null;
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    src = candidate;
    break;
  }
}

if (src) {
  fs.copyFileSync(src, dest);
  console.log(`[setup-onesignal-stub] Wrote stubs/onesignal/package.json from ${path.basename(src)}`);
} else {
  // Last resort: write inline so the build never fails
  fs.writeFileSync(dest, JSON.stringify({
    name: 'react-native-onesignal',
    version: '5.4.1',
    main: 'index.js',
    types: 'index.d.ts',
  }));
  console.log('[setup-onesignal-stub] Wrote stubs/onesignal/package.json inline (no source file found)');
}
