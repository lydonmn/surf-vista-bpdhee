
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../integrations/supabase/client';

const DEVICE_ID_KEY = 'usage_tracking_device_id';
const SESSION_ID_KEY = 'usage_tracking_session_id';
const SESSION_START_KEY = 'usage_tracking_session_start';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUUID(): string {
  // Simple RFC-4122 v4 UUID without crypto dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns a stable device_id, generating and persisting one on first call.
 */
export async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const newId = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    console.log('[UsageTracking] Generated new device_id:', newId);
    return newId;
  } catch (err) {
    console.warn('[UsageTracking] Could not persist device_id:', err);
    return generateUUID();
  }
}

/**
 * Fire-and-forget direct Supabase insert.
 * Never throws — all errors are swallowed so callers are never blocked.
 */
function insertEvent(payload: {
  event_type: string;
  session_id: string;
  device_id: string;
  user_id?: string | null;
  duration_seconds?: number;
  video_id?: string;
  video_title?: string;
  spot_id?: string;
  screen_name?: string;
  properties?: Record<string, unknown>;
}): void {
  console.log('[UsageTracking] Inserting event:', payload.event_type, payload);
  supabase
    .from('app_usage_events')
    .insert(payload)
    .then(({ error }) => {
      if (error) {
        console.warn('[UsageTracking] Insert error for', payload.event_type, error.message, error.code);
      } else {
        console.log('[UsageTracking] Event inserted successfully:', payload.event_type);
      }
    })
    .catch((err) => {
      console.warn('[UsageTracking] Unexpected error inserting event:', payload.event_type, err);
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call at app boot and post-login.
 * Calls the Supabase RPC merge_anonymous_identity to link device to user,
 * and also calls linkSessionToUser to backfill the current session.
 */
export async function identify(userId: string): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    console.log('[UsageTracking] identify — userId:', userId, 'deviceId:', deviceId);

    // Merge anonymous device identity into the user account
    const { error: rpcError } = await supabase.rpc('merge_anonymous_identity', {
      anonymous_id: deviceId,
      user_id: userId,
    });
    if (rpcError) {
      console.warn('[UsageTracking] merge_anonymous_identity RPC error:', rpcError.message);
    } else {
      console.log('[UsageTracking] merge_anonymous_identity succeeded for user:', userId);
    }

    // Also backfill the current session rows
    await linkSessionToUser(userId);
  } catch (err) {
    console.warn('[UsageTracking] Error in identify:', err);
  }
}

/**
 * Call on every app open (initial mount + returning from background).
 * Fires event_type: 'app_open', generates a new session_id, stores it.
 * Returns the new session_id.
 */
export async function trackAppOpen(userId?: string): Promise<string> {
  const sessionId = generateUUID();
  const now = Date.now();

  try {
    await Promise.all([
      AsyncStorage.setItem(SESSION_ID_KEY, sessionId),
      AsyncStorage.setItem(SESSION_START_KEY, String(now)),
    ]);
  } catch (err) {
    console.warn('[UsageTracking] Could not persist session data:', err);
  }

  const deviceId = await getDeviceId();

  console.log('[UsageTracking] App open — session_id:', sessionId, 'user_id:', userId ?? 'anonymous');

  insertEvent({
    event_type: 'app_open',
    session_id: sessionId,
    device_id: deviceId,
    user_id: userId ?? null,
  });

  return sessionId;
}

/**
 * Call when app goes to background or becomes inactive.
 * Fires event_type: 'app_background' with duration_seconds since last open.
 */
export async function trackAppBackground(userId?: string): Promise<void> {
  try {
    const [sessionId, startRaw, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      AsyncStorage.getItem(SESSION_START_KEY),
      getDeviceId(),
    ]);

    const durationSeconds = startRaw
      ? Math.round((Date.now() - parseInt(startRaw, 10)) / 1000)
      : undefined;

    console.log(
      '[UsageTracking] App background — session_id:', sessionId,
      'duration_seconds:', durationSeconds,
      'user_id:', userId ?? 'anonymous'
    );

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'app_background',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
    };
    if (durationSeconds !== undefined) {
      payload.duration_seconds = durationSeconds;
    }

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackAppBackground:', err);
  }
}

/**
 * Links an existing anonymous session to a user after login.
 * Updates app_usage_events rows where session_id matches and user_id is null.
 */
export async function linkSessionToUser(userId: string): Promise<void> {
  try {
    const sessionId = await AsyncStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) return;
    console.log('[UsageTracking] Linking session', sessionId, 'to user', userId);
    await supabase
      .from('app_usage_events')
      .update({ user_id: userId })
      .eq('session_id', sessionId)
      .is('user_id', null);
  } catch (e) {
    console.warn('[UsageTracking] Error linking session to user:', e);
  }
}

/**
 * Call when the forecast/conditions tab is viewed.
 * Fires event_type: 'forecast_view'.
 */
export async function trackForecastView(userId?: string): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log('[UsageTracking] Forecast view — user_id:', userId ?? 'anonymous');

    insertEvent({
      event_type: 'forecast_view',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
    });
  } catch (err) {
    console.warn('[UsageTracking] Error in trackForecastView:', err);
  }
}

/**
 * Call when the app is opened via a notification tap.
 * Fires event_type: 'notification_open'. notificationType stored in video_title field.
 */
export async function trackNotificationOpen(userId?: string, notificationType?: string): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log(
      '[UsageTracking] Notification open — type:', notificationType ?? 'unknown',
      'user_id:', userId ?? 'anonymous'
    );

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'notification_open',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
    };
    if (notificationType) payload.video_title = notificationType;

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackNotificationOpen:', err);
  }
}

/**
 * Call when a video finishes or is dismissed.
 * Fires event_type: 'video_watch'.
 */
export async function trackVideoWatch(
  userId?: string,
  videoId?: string,
  videoTitle?: string,
  durationSeconds?: number
): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log(
      '[UsageTracking] Video watch — video_id:', videoId,
      'title:', videoTitle,
      'duration_seconds:', durationSeconds,
      'user_id:', userId ?? 'anonymous'
    );

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'video_watch',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
    };
    if (videoId) payload.video_id = videoId;
    if (videoTitle) payload.video_title = videoTitle;
    if (durationSeconds !== undefined) payload.duration_seconds = durationSeconds;

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackVideoWatch:', err);
  }
}

/**
 * Call when a surf spot forecast page is viewed.
 * Fires event_type: 'spot_viewed' with spot_id and screen_name: 'forecast'.
 */
export async function trackSpotViewed(userId?: string, spotId?: string, spotName?: string): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log(
      '[UsageTracking] Spot viewed — spot_id:', spotId,
      'spot_name:', spotName,
      'user_id:', userId ?? 'anonymous'
    );

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'spot_viewed',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
      screen_name: 'forecast',
    };
    if (spotId) payload.spot_id = spotId;

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackSpotViewed:', err);
  }
}

// NOTE: No camera feed UI exists yet. Call this when a live camera feed component mounts.
/**
 * Call when a camera feed for a surf spot is viewed.
 * Fires event_type: 'camera_feed_viewed' with spot_id.
 */
export async function trackCameraFeedViewed(userId?: string, spotId?: string, spotName?: string): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log(
      '[UsageTracking] Camera feed viewed — spot_id:', spotId,
      'spot_name:', spotName,
      'user_id:', userId ?? 'anonymous'
    );

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'camera_feed_viewed',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
    };
    if (spotId) payload.spot_id = spotId;

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackCameraFeedViewed:', err);
  }
}

/**
 * Call when the paywall screen is shown to the user.
 * Fires event_type: 'paywall_shown' with screen_name set to paywallId.
 */
export async function trackPaywallShown(userId?: string, paywallId?: string): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log(
      '[UsageTracking] Paywall shown — paywallId:', paywallId ?? 'default',
      'user_id:', userId ?? 'anonymous'
    );

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'paywall_shown',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
      screen_name: paywallId ?? 'paywall',
    };

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackPaywallShown:', err);
  }
}

/**
 * Call when a subscription purchase is confirmed.
 * Fires event_type: 'subscription_started' with product_id and price in properties.
 */
export async function trackSubscriptionStarted(
  userId?: string,
  productId?: string,
  price?: string
): Promise<void> {
  try {
    const [sessionId, deviceId] = await Promise.all([
      AsyncStorage.getItem(SESSION_ID_KEY),
      getDeviceId(),
    ]);

    console.log(
      '[UsageTracking] Subscription started — product_id:', productId,
      'price:', price,
      'user_id:', userId ?? 'anonymous'
    );

    const properties: Record<string, unknown> = {};
    if (productId) properties.product_id = productId;
    if (price) properties.price = price;

    const payload: Parameters<typeof insertEvent>[0] = {
      event_type: 'subscription_started',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      user_id: userId ?? null,
      properties: Object.keys(properties).length > 0 ? properties : undefined,
    };

    insertEvent(payload);
  } catch (err) {
    console.warn('[UsageTracking] Error in trackSubscriptionStarted:', err);
  }
}
