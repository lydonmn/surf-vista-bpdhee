const fs = require('fs');
const path = require('path');

function afterAllResolved(lockfile, context) {
  try {
    const stubDir = path.resolve(__dirname, 'stubs/onesignal');
    const dest = path.join(stubDir, 'package.json');
    const candidates = [
      path.join(stubDir, 'pkg.json'),
      path.join(stubDir, 'package.json.txt'),
    ];
    let src = null;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) { src = candidate; break; }
    }
    if (src) {
      fs.copyFileSync(src, dest);
      if (context && context.log) context.log('[pnpmfile] Wrote stubs/onesignal/package.json from ' + path.basename(src));
    } else {
      fs.writeFileSync(dest, '{"name":"react-native-onesignal","version":"5.4.1","main":"index.js","types":"index.d.ts"}');
    }
  } catch (e) {
    console.warn('[pnpmfile] Could not create onesignal stub package.json:', e.message);
  }
  return lockfile;
}

module.exports = { hooks: { afterAllResolved } };
