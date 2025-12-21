
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '@/contexts/AuthContext';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <WidgetProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="admin-data" options={{ headerShown: false }} />
              <Stack.Screen name="admin-debug" options={{ headerShown: false }} />
              <Stack.Screen name="setup-admin" options={{ headerShown: false }} />
              <Stack.Screen name="edit-report" options={{ headerShown: false }} />
              <Stack.Screen name="video-player" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
              <Stack.Screen name="video-player-simple" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
              <Stack.Screen 
                name="modal" 
                options={{ 
                  presentation: 'modal',
                  headerShown: false,
                }} 
              />
              <Stack.Screen 
                name="transparent-modal" 
                options={{ 
                  presentation: 'transparentModal',
                  headerShown: false,
                  animation: 'fade',
                }} 
              />
              <Stack.Screen 
                name="formsheet" 
                options={{ 
                  presentation: 'formSheet',
                  headerShown: false,
                }} 
              />
            </Stack>
          </ThemeProvider>
        </WidgetProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
