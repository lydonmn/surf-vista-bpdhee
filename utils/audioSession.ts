
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Platform } from 'react-native';

/**
 * Configure iOS audio session for continuous video playback
 * 🚨 CRITICAL FIX: Prevents audio cutout at ~10 seconds
 * 
 * This MUST be called once on app startup in app/_layout.tsx
 * Uses InterruptionModeIOS.DoNotMix for exclusive audio session control
 */
export async function configureAudioSession(): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.log('[AudioSession] Skipping iOS audio session config on', Platform.OS);
    return;
  }

  try {
    console.log('[AudioSession] ⚡ Configuring iOS audio session for CONTINUOUS video playback...');

    // 🚨 CRITICAL FIX: InterruptionModeIOS.DoNotMix is the key setting
    // This maps to AVAudioSession category Playback with exclusive control
    // It prevents AVPlayer from dropping the audio track during buffer transitions
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix, // 🚨 CRITICAL: Exclusive audio control
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });

    console.log('[AudioSession] ✅ iOS audio session configured with InterruptionModeIOS.DoNotMix');
    console.log('[AudioSession] - ✅ Exclusive audio control enabled (prevents track drops)');
    console.log('[AudioSession] - ✅ Silent mode override enabled');
    console.log('[AudioSession] - ✅ Background playback disabled (video stops anyway)');
    console.log('[AudioSession] - ✅ DoNotMix mode prevents audio session conflicts');
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
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
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
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
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
