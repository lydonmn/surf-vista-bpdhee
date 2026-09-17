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
        <View style={styles.loadingOverlay}>
          <Svg width={48} height={56} viewBox="0 0 48 56">
            <Path
              d="M 24 4 C 24 4 8 20 6 36 C 4 48 14 52 24 52 C 34 52 44 48 42 36 C 40 20 24 4 24 4 Z"
              fill="#60A5FA"
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
