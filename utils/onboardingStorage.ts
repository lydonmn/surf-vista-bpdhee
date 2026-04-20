// Uses expo-secure-store which is compatible with standard Expo Go, web, and production builds.
// DO NOT replace with @react-native-async-storage/async-storage — it requires a native/dev build
// and will crash with "Native module is null" in standard Expo Go.
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Scoped per project so different apps on the same Expo Go device don't share onboarding state
const _PROJECT_SCOPE = Constants.expoConfig?.extra?.nativelyProjectId || Constants.expoConfig?.slug || "app";
const ONBOARDING_KEY = `onboarding_complete_${_PROJECT_SCOPE}`;

const APP_OPEN_COUNT_KEY = "app_open_count";
const SURVEY_SHOWN_KEY = "survey_shown";

export async function isOnboardingComplete(): Promise<boolean> {
  if (Platform.OS === "web") {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  }
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === "true";
}

export async function completeOnboarding(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(ONBOARDING_KEY, "true");
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
}

export async function resetOnboarding(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(ONBOARDING_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ONBOARDING_KEY);
}

// --- App open counter ---

export async function incrementAppOpenCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(APP_OPEN_COUNT_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = current + 1;
    await AsyncStorage.setItem(APP_OPEN_COUNT_KEY, String(next));
    console.log("[onboardingStorage] App open count incremented to:", next);
    return next;
  } catch (err) {
    console.warn("[onboardingStorage] Failed to increment app open count:", err);
    return 0;
  }
}

export async function getAppOpenCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(APP_OPEN_COUNT_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch (err) {
    console.warn("[onboardingStorage] Failed to get app open count:", err);
    return 0;
  }
}

// --- Survey shown flag ---

export async function markSurveyShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(SURVEY_SHOWN_KEY, "true");
    console.log("[onboardingStorage] Survey marked as shown");
  } catch (err) {
    console.warn("[onboardingStorage] Failed to mark survey shown:", err);
  }
}

export async function hasSurveyBeenShown(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(SURVEY_SHOWN_KEY);
    return value === "true";
  } catch (err) {
    console.warn("[onboardingStorage] Failed to check survey shown:", err);
    return false;
  }
}

// --- Name prompt ---

const NAME_PROMPT_KEY = "name_prompt_last_shown";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function shouldShowNamePrompt(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NAME_PROMPT_KEY);
    if (!raw) return true;
    const lastShown = parseInt(raw, 10);
    if (isNaN(lastShown)) return true;
    return Date.now() - lastShown > THIRTY_DAYS_MS;
  } catch (err) {
    console.warn("[onboardingStorage] Failed to check name prompt:", err);
    return false;
  }
}

export async function markNamePromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(NAME_PROMPT_KEY, String(Date.now()));
    console.log("[onboardingStorage] Name prompt timestamp saved");
  } catch (err) {
    console.warn("[onboardingStorage] Failed to mark name prompt shown:", err);
  }
}

export async function suppressNamePromptForever(): Promise<void> {
  try {
    // Far-future timestamp (year 2099) so it never prompts again
    const farFuture = new Date("2099-01-01").getTime();
    await AsyncStorage.setItem(NAME_PROMPT_KEY, String(farFuture));
    console.log("[onboardingStorage] Name prompt suppressed forever");
  } catch (err) {
    console.warn("[onboardingStorage] Failed to suppress name prompt:", err);
  }
}
