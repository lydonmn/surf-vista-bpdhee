import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { useTheme } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

export default function LiveCam() {
  const { dark } = useTheme();
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: dark ? '#0a0a0a' : '#000' }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📷</Text>
          <Text style={[styles.errorTitle, { color: dark ? '#fff' : '#eee' }]}>Feed Unavailable</Text>
          <Text style={[styles.errorText, { color: dark ? '#aaa' : '#ccc' }]}>
            The live cam feed is temporarily offline. Check back soon.
          </Text>
        </View>
      </View>
    );
  }

  if (!started) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.overlayContainer, { backgroundColor: 'rgba(0,0,0,0.85)' }]}
        onPress={() => {
          console.log('[LiveCam] User tapped to start live feed');
          setStarted(true);
        }}
        activeOpacity={0.8}
      >
        <Svg width={44} height={56} viewBox="0 0 44 56">
          {/* Longboard single-fin silhouette — outline only, white stroke */}
          <Path
            d="M 6 52 C 2 30, 6 14, 14 4 C 20 18, 34 36, 38 52 Z"
            fill="none"
            stroke="white"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Base tab */}
          <Path
            d="M 4 52 C 10 58, 34 58, 40 52"
            fill="none"
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.tapText}>Tap to watch live</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0a0a0a' : '#000' }]}>
      <WebView
        source={{ uri: 'https://coastalcameranetwork.com/webcams/surf-vista/webcam-app.php' }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onError={() => {
          console.log('[LiveCam] Feed load error');
          setError(true);
        }}
        onHttpError={() => {
          console.log('[LiveCam] Feed HTTP error');
          setError(true);
        }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  overlayContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  tapText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  errorIcon: { fontSize: 36 },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
