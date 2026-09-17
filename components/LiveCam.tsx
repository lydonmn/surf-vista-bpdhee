import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { useTheme } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

export default function LiveCam() {
  const { dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFinOverlay, setShowFinOverlay] = useState(true);

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0a0a0a' : '#000' }]}>
      {loading && !error && showFinOverlay && (
        <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <Svg width={40} height={52} viewBox="0 0 40 52">
            <Path
              d="M 18 2 C 14 8 8 18 6 28 C 4 38 6 48 8 50 L 32 50 C 34 46 34 38 30 28 C 26 18 22 8 18 2 Z"
              fill="none"
              stroke="white"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={[styles.loadingText, { color: dark ? '#aaa' : '#ccc' }]}>
            Loading live feed…
          </Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📷</Text>
          <Text style={[styles.errorTitle, { color: dark ? '#fff' : '#eee' }]}>Feed Unavailable</Text>
          <Text style={[styles.errorText, { color: dark ? '#aaa' : '#ccc' }]}>
            The live cam feed is temporarily offline. Check back soon.
          </Text>
        </View>
      ) : (
        <WebView
          source={{ uri: 'https://coastalcameranetwork.com/webcams/surf-vista/webcam-app.php' }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onLoadEnd={() => {
            console.log('[LiveCam] Feed loaded successfully');
            setLoading(false);
            setShowFinOverlay(false);
          }}
          onError={() => {
            console.log('[LiveCam] Feed load error');
            setLoading(false);
            setShowFinOverlay(false);
            setError(true);
          }}
          onHttpError={() => {
            console.log('[LiveCam] Feed HTTP error');
            setLoading(false);
            setShowFinOverlay(false);
            setError(true);
          }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
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
