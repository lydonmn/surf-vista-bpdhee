const fs = require('fs');
const path = require('path');
const stubDir = path.resolve(__dirname, '../stubs/onesignal');
const src = path.join(stubDir, 'package.json.txt');
const dest = path.join(stubDir, 'package.json');
if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('[setup-onesignal-stub] Created stubs/onesignal/package.json');
} else {
  console.warn('[setup-onesignal-stub] package.json.txt not found, skipping');
}
