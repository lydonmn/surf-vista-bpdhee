
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Root index screen - handles initial routing logic
 * Redirects to tabs or login based on authentication state
 */
export default function Index() {
  console.log('[Index] ===== ROOT INDEX SCREEN RENDERING =====');
  
  const { user, isLoading, isInitialized } = useAuth();
  
  console.log('[Index] Auth state:', { 
    user: user?.id, 
    isLoading, 
    isInitialized 
  });

  useEffect(() => {
    console.log('[Index] Component mounted');
    return () => {
      console.log('[Index] Component unmounted');
    };
  }, []);

  // Show loading indicator while auth is initializing
  // But don't block for too long - failsafe timeout in AuthContext
  if (isLoading || !isInitialized) {
    console.log('[Index] Showing loading indicator');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect to tabs (home) - AuthContext will handle login redirect if needed
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
