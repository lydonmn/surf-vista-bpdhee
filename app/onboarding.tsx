import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { onboardingQuestions } from "@/constants/OnboardingQuestions";
import { completeOnboarding, markSurveyShown } from "@/utils/onboardingStorage";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { useOnboardingColors } from "@/hooks/useOnboardingColors";
import { useAuth } from "@/contexts/AuthContext";

const SUPABASE_URL = "https://ucbilksfpnmltrkwvzft.supabase.co";
const DEVICE_ID_KEY = "device_id";
const TOTAL_STEPS = onboardingQuestions.length;

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    // Generate a simple UUID v4
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    await AsyncStorage.setItem(DEVICE_ID_KEY, uuid);
    return uuid;
  } catch {
    return "unknown";
  }
}

async function submitSurvey(
  userId: string | null,
  deviceId: string,
  answers: Record<string, string>
): Promise<void> {
  const body = {
    user_id: userId,
    device_id: deviceId,
    how_found: answers["how_found"] ?? "",
    surf_location: answers["surf_location"] ?? "",
    improvement: answers["improvement"] ?? "",
  };
  console.log("[Onboarding] Submitting survey to backend:", body);
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/survey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("[Onboarding] Survey submission failed:", response.status, text);
    } else {
      console.log("[Onboarding] Survey submitted successfully");
    }
  } catch (err) {
    console.warn("[Onboarding] Survey submission error:", err);
  }
}

export default function OnboardingScreen() {
  const colors = useOnboardingColors();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const opacity = useSharedValue(1);
  const isAnimating = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const question = onboardingQuestions[currentStep];
  const currentAnswer = answers[question?.id] ?? "";
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const isFirstStep = currentStep === 0;
  const canContinue = currentAnswer.trim().length > 0;

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const goBack = useCallback(() => {
    if (!isFirstStep && !isAnimating.current) {
      console.log("[Onboarding] Going back to step", currentStep - 1);
      isAnimating.current = true;
      opacity.value = withTiming(0, { duration: 150 });
      setTimeout(() => {
        setCurrentStep((prev) => Math.max(0, prev - 1));
        opacity.value = withTiming(1, { duration: 200 });
        isAnimating.current = false;
      }, 150);
    }
  }, [isFirstStep, currentStep, opacity]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isFirstStep) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isFirstStep, goBack]);

  // Focus input when step changes
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const handleChangeText = (text: string) => {
    setAnswers((prev) => ({ ...prev, [question.id]: text }));
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    if (isLastStep) {
      console.log("[Onboarding] Last step reached, completing survey. Answers:", answers);
      await completeOnboarding();

      // Fire-and-forget survey submission
      getOrCreateDeviceId().then((deviceId) => {
        submitSurvey(user?.id ?? null, deviceId, answers);
      });
      markSurveyShown().catch(() => {});

      console.log("[Onboarding] Onboarding marked complete, navigating to paywall");
      router.replace("/paywall");
      const { openPaywall } = await import("@/utils/paywallHelper");
      openPaywall().catch(() => {});
    } else {
      console.log("[Onboarding] Advancing to step", currentStep + 1);
      if (isAnimating.current) return;
      isAnimating.current = true;
      opacity.value = withTiming(0, { duration: 150 });
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        opacity.value = withTiming(1, { duration: 200 });
        isAnimating.current = false;
      }, 150);
    }
  };

  if (!question) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {!isFirstStep ? (
          <Pressable onPress={goBack} style={styles.backButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <View style={styles.progressWrapper}>
          <ProgressBar totalSteps={TOTAL_STEPS} currentStep={currentStep} />
        </View>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.questionSection}>
            <Text style={[styles.title, { color: colors.text }]}>
              {question.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text + "99" }]}>
              {question.subtitle}
            </Text>
          </View>

          <View style={styles.inputSection}>
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                {
                  color: colors.text,
                  borderColor: colors.primary + "66",
                  backgroundColor: colors.text + "0D",
                },
              ]}
              value={currentAnswer}
              onChangeText={handleChangeText}
              placeholder="Type your answer here..."
              placeholderTextColor={colors.text + "55"}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: 16 }]}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            style={[
              styles.continueButton,
              {
                backgroundColor: colors.primary,
                opacity: canContinue ? 1 : 0.4,
              },
            ]}
          >
            <Text style={styles.continueText}>
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrapper: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questionSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputSection: {
    flex: 1,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 140,
    maxHeight: 240,
  },
  footer: {
    paddingHorizontal: 24,
  },
  continueButton: {
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
