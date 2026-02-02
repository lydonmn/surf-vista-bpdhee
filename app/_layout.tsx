
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '@/contexts/AuthContext';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
        <LocationProvider>
          <WidgetProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="admin-data" />
                <Stack.Screen name="admin-debug" />
                <Stack.Screen name="admin-users" />
                <Stack.Screen name="admin-predictions" />
                <Stack.Screen name="admin-cron-logs" />
                <Stack.Screen name="setup-admin" />
                <Stack.Screen name="edit-report" />
                <Stack.Screen 
                  name="video-player" 
                  options={{ 
                    presentation: 'fullScreenModal',
                    animation: 'slide_from_bottom'
                  }} 
                />
                <Stack.Screen 
                  name="video-player-simple" 
                  options={{ 
                    presentation: 'fullScreenModal',
                    animation: 'slide_from_bottom'
                  }} 
                />
                <Stack.Screen 
                  name="modal" 
                  options={{ 
                    presentation: 'modal'
                  }} 
                />
                <Stack.Screen 
                  name="transparent-modal" 
                  options={{ 
                    presentation: 'transparentModal',
                    animation: 'fade'
                  }} 
                />
                <Stack.Screen 
                  name="formsheet" 
                  options={{ 
                    presentation: 'formSheet'
                  }} 
                />
                <Stack.Screen 
                  name="privacy-policy" 
                  options={{ 
                    presentation: 'modal',
                    headerShown: true,
                    title: 'Privacy Policy'
                  }} 
                />
                <Stack.Screen 
                  name="terms-of-service" 
                  options={{ 
                    presentation: 'modal',
                    headerShown: true,
                    title: 'Terms of Service'
                  }} 
                />
              </Stack>
            </ThemeProvider>
          </WidgetProvider>
        </LocationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
