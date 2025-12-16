
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "#4682B4",
      background: "#F0F8FF",
      card: "#FFFFFF",
      text: "#2F4F4F",
      border: "#B0C4DE",
      notification: "#FFA07A",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "#4682B4",
      background: "#1a1a2e",
      card: "#16213e",
      text: "#F0F8FF",
      border: "#0f3460",
      notification: "#FFA07A",
    },
  };

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
      >
        <AuthProvider>
          <GestureHandlerRootView>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen 
                name="login" 
                options={{ 
                  headerShown: false,
                  presentation: "modal"
                }} 
              />
              <Stack.Screen 
                name="setup-admin" 
                options={{ 
                  headerShown: true,
                  title: "Admin Setup",
                  presentation: "modal"
                }} 
              />
              <Stack.Screen 
                name="video-player" 
                options={{ 
                  headerShown: true,
                  title: "Video Player",
                  presentation: "modal"
                }} 
              />
              <Stack.Screen 
                name="admin" 
                options={{ 
                  headerShown: true,
                  title: "Admin Panel",
                  presentation: "modal"
                }} 
              />
            </Stack>
            <SystemBars style={"auto"} />
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
