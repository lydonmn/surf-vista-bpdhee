
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
    console.log('[AudioSession] ⚡ Configuring audio session for SEAMLESS CONTINUOUS playback...');
    console.log('[AudioSession] Config:', finalConfig);

    // ✅ CRITICAL FIX: Optimized audio configuration for seamless playback on iPhone
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      // 🚨 CRITICAL: DoNotMix prevents iOS from interrupting video audio
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });

    console.log('[AudioSession] ✅ Audio session configured for SEAMLESS playback');
    console.log('[AudioSession] - ✅ Continuous playback enabled (no interruptions)');
    console.log('[AudioSession] - ✅ Background audio enabled');
    console.log('[AudioSession] - ✅ Silent mode override enabled (iOS)');
    console.log('[AudioSession] - ✅ DoNotMix mode prevents audio session deactivation');
  } catch (error) {
    console.error('[AudioSession] ❌ Failed to configure audio session:', error);
  }
}

export async function activateAudioSession(): Promise<void> {
  try {
    console.log('[AudioSession] ⚡ Activating audio session...');
    
    // ✅ CRITICAL FIX: Simplified activation - no repeated reactivation needed
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
    
    console.log('[AudioSession] ✅ Audio session activated');
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
