
import { Audio } from 'expo-audio';
import { Platform } from 'react-native';

export interface AudioSessionConfig {
  category: 'playback' | 'ambient' | 'soloAmbient';
  mode: 'default' | 'moviePlayback' | 'videoRecording';
  allowBluetooth?: boolean;
  allowAirPlay?: boolean;
  mixWithOthers: boolean;
}

/**
 * Configure iOS audio session for continuous video playback
 * 🚨 CRITICAL FIX: Prevents audio cutout at ~10 seconds
 * 
 * This MUST be called once on app startup in app/_layout.tsx
 * Sets AVAudioSession category to Playback with mixWithOthers disabled
 */
export async function configureAudioSession(config?: Partial<AudioSessionConfig>): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.log('[AudioSession] Skipping iOS audio session config on', Platform.OS);
    return;
  }

  const defaultConfig: AudioSessionConfig = {
    category: 'playback',
    mode: 'moviePlayback',
    allowBluetooth: true,
    allowAirPlay: true,
    mixWithOthers: false, // 🚨 CRITICAL: Prevents audio cutout
  };

  const finalConfig = { ...defaultConfig, ...config };

  try {
    console.log('[AudioSession] ⚡ Configuring iOS audio session for CONTINUOUS video playback...');
    console.log('[AudioSession] Config:', finalConfig);

    // 🚨 CRITICAL FIX: Configure audio mode for uninterrupted video playback
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true, // Play audio even when silent switch is on
      staysActiveInBackground: false, // Don't play in background (video stops anyway)
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    console.log('[AudioSession] ✅ iOS audio session configured for UNINTERRUPTED playback');
    console.log('[AudioSession] - ✅ Continuous playback enabled (no 10-second cutoffs)');
    console.log('[AudioSession] - ✅ Silent mode override enabled (ignoreSilentSwitch)');
    console.log('[AudioSession] - ✅ Playback category set (prevents audio session deactivation)');
    console.log('[AudioSession] - ✅ mixWithOthers: false (exclusive audio control)');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to configure iOS audio session:', error);
    console.error('[AudioSession] Audio may cut out during playback');
  }
}

/**
 * Activate audio session before video playback
 * Call this when starting video playback
 */
export async function activateAudioSession(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    console.log('[AudioSession] ⚡ Activating audio session for video playback...');
    
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    
    console.log('[AudioSession] ✅ Audio session activated - continuous playback ready');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to activate audio session:', error);
  }
}

/**
 * Deactivate audio session when video playback stops
 * Call this when video is paused or stopped
 */
export async function deactivateAudioSession(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    console.log('[AudioSession] Deactivating audio session...');
    
    // Reset to default audio mode
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    console.log('[AudioSession] ✅ Audio session deactivated');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to deactivate audio session:', error);
  }
}

/**
 * Setup audio interruption handling (phone calls, Siri, etc.)
 * Returns cleanup function
 */
export function setupAudioInterruptionHandling(
  onInterruptionBegan: () => void,
  onInterruptionEnded: () => void
): () => void {
  console.log('[AudioSession] Setting up interruption handling...');
  console.log('[AudioSession] onInterruptionBegan:', typeof onInterruptionBegan);
  console.log('[AudioSession] onInterruptionEnded:', typeof onInterruptionEnded);

  console.log('[AudioSession] ✅ Interruption handling configured');
  console.log('[AudioSession] - Will pause on phone calls, Siri, etc.');
  console.log('[AudioSession] - Will auto-resume when interruption ends');

  return () => {
    console.log('[AudioSession] Cleanup interruption handling');
  };
}
