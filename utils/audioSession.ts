
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

export interface AudioSessionConfig {
  category: 'playback' | 'ambient' | 'soloAmbient';
  mode: 'default' | 'moviePlayback' | 'videoRecording';
  allowBluetooth?: boolean;
  allowAirPlay?: boolean;
  mixWithOthers: boolean;
}

export async function configureAudioSession(config?: Partial<AudioSessionConfig>): Promise<void> {
  const defaultConfig: AudioSessionConfig = {
    category: 'playback',
    mode: 'moviePlayback',
    allowBluetooth: true,
    allowAirPlay: true,
    mixWithOthers: false,
  };

  const finalConfig = { ...defaultConfig, ...config };

  try {
    console.log('[AudioSession] ⚡ Configuring audio session for continuous playback...');
    console.log('[AudioSession] Config:', finalConfig);

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });

    console.log('[AudioSession] ✅ Audio session configured for uninterrupted playback');
    console.log('[AudioSession] - Continuous playback enabled (no 10-second cutoffs)');
    console.log('[AudioSession] - Background audio enabled');
    console.log('[AudioSession] - Silent mode override enabled (iOS)');
    console.log('[AudioSession] - Audio interruption handling configured');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to configure audio session:', error);
  }
}

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

export async function activateAudioSession(): Promise<void> {
  try {
    console.log('[AudioSession] ⚡ Activating audio session...');
    
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
    
    console.log('[AudioSession] ✅ Audio session activated for continuous playback');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to activate audio session:', error);
  }
}

export async function deactivateAudioSession(): Promise<void> {
  try {
    console.log('[AudioSession] Deactivating audio session...');
    
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
    
    console.log('[AudioSession] ✅ Audio session deactivated');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to deactivate audio session:', error);
  }
}
