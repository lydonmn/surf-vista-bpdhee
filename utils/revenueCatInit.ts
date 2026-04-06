import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';

let _resolveConfigured: () => void;
let _configured = false;

// This promise resolves once Purchases.configure() has been called successfully
export const revenueCatConfigured = new Promise<void>((resolve) => {
  _resolveConfigured = resolve;
});

export async function configureRevenueCat(): Promise<void> {
  if (_configured) return;
  if (Platform.OS === 'web') {
    _resolveConfigured();
    return;
  }
  try {
    if (typeof Purchases?.configure !== 'function') {
      console.warn('[RC] react-native-purchases native module not available');
      _resolveConfigured();
      return;
    }
    const extra = Constants.expoConfig?.extra || {};
    const testKey = extra.revenueCatTestApiKeyIos || extra.revenueCatTestApiKeyAndroid || '';
    const productionKey =
      Platform.OS === 'ios'
        ? (extra.revenueCatApiKeyIos || '')
        : (extra.revenueCatApiKeyAndroid || '');
    const usingTestKey = __DEV__ && !!testKey;
    const apiKey = usingTestKey ? testKey : productionKey;
    if (!apiKey) {
      console.warn('[RC] No API key found — cannot configure. __DEV__:', __DEV__, 'platform:', Platform.OS);
      _resolveConfigured();
      return;
    }
    console.log('[RC] Configuring with', usingTestKey ? 'TEST key' : 'PRODUCTION key', 'platform:', Platform.OS);
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey });
    _configured = true;
    console.log('[RC] Purchases.configure() complete — ready to present paywall');
    _resolveConfigured();
  } catch (e) {
    console.warn('[RC] configure error:', e);
    _resolveConfigured(); // resolve anyway so UI never hangs
  }
}

export function isRevenueCatConfigured(): boolean {
  return _configured;
}
