
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
