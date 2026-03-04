
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';

/**
 * 🚨 CRITICAL FIX: Root index screen with minimal initialization delay
 * Shows a brief loading indicator to ensure contexts are ready
 */
export default function Index() {
  console.log('[Index] ===== ROOT INDEX SCREEN RENDERING =====');
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Give contexts a moment to initialize
    const timer = setTimeout(() => {
      console.log('[Index] Initialization complete, redirecting to tabs');
      setIsReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!isReady) {
    console.log('[Index] Showing loading indicator...');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  
  console.log('[Index] Redirecting to /(tabs)');
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});
