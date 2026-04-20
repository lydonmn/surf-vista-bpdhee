/**
 * pnpm lifecycle hook.
 *
 * Copies stubs/onesignal/package.json.txt → stubs/onesignal/package.json
 * so that Node/Metro can resolve the local react-native-onesignal stub
 * declared as "file:stubs/onesignal" in package.json.
 *
 * This runs automatically on every `pnpm install`, including EAS builds.
 */

const fs = require('fs');
const path = require('path');

function afterAllResolved(lockfile, context) {
  try {
    const stubDir = path.resolve(__dirname, 'stubs/onesignal');
    const src = path.join(stubDir, 'package.json.txt');
    const dest = path.join(stubDir, 'package.json');
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      context.log('[pnpmfile] Created stubs/onesignal/package.json from package.json.txt');
    }
  } catch (e) {
    // Non-fatal — log and continue
    console.warn('[pnpmfile] Could not create onesignal stub package.json:', e.message);
  }
  return lockfile;
}

module.exports = { hooks: { afterAllResolved } };
