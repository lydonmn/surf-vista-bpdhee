/**
 * pnpm lifecycle hook.
 *
 * OneSignal patching has been removed — react-native-onesignal now resolves
 * to the local no-op stub at stubs/onesignal via the "file:" dependency in
 * package.json, so no post-install patching is needed.
 */

module.exports = {};
