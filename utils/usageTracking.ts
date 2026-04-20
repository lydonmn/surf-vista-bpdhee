
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACK_USAGE_URL = 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/track-usage';

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
 * Fire-and-forget POST to the track-usage edge function.
 * Never throws — all errors are swallowed so callers are never blocked.
 */
function postEvent(payload: Record<string, unknown>): void {
  console.log('[UsageTracking] Posting event:', payload.event_type, payload);
  fetch(TRACK_USAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) {
        res.text().then((text) =>
          console.warn('[UsageTracking] Non-OK response for', payload.event_type, res.status, text)
        );
      } else {
        console.log('[UsageTracking] Event tracked successfully:', payload.event_type);
      }
    })
    .catch((err) => {
      console.warn('[UsageTracking] Network error posting event:', payload.event_type, err);
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

  postEvent({
    event_type: 'app_open',
    session_id: sessionId,
    device_id: deviceId,
    ...(userId ? { user_id: userId } : {}),
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

    postEvent({
      event_type: 'app_background',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
      ...(userId ? { user_id: userId } : {}),
    });
  } catch (err) {
    console.warn('[UsageTracking] Error in trackAppBackground:', err);
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

    postEvent({
      event_type: 'video_watch',
      session_id: sessionId ?? generateUUID(),
      device_id: deviceId,
      ...(userId ? { user_id: userId } : {}),
      ...(videoId ? { video_id: videoId } : {}),
      ...(videoTitle ? { video_title: videoTitle } : {}),
      ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
    });
  } catch (err) {
    console.warn('[UsageTracking] Error in trackVideoWatch:', err);
  }
}
