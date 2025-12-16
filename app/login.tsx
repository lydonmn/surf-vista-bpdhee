
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { isPaymentSystemAvailable, presentPaywall, checkPaymentConfiguration, PAYMENT_CONFIG } from '@/utils/superwallConfig';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, signUp, user, profile, isLoading: authLoading, checkSubscription, refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Redirect if already logged in with subscription
  useEffect(() => {
    if (user && profile && !authLoading && checkSubscription()) {
      console.log('[LoginScreen] User already logged in with subscription, redirecting...');
      router.replace('/(tabs)/(home)/');
    }
  }, [user, profile, authLoading]);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    if (isSignUp) {
      const result = await signUp(email, password);
      setIsLoading(false);
      
      Alert.alert(
        result.success ? 'Success' : 'Error',
        result.message,
        [
          {
            text: 'OK',
            onPress: () => {
              if (result.success) {
                setIsSignUp(false);
                setPassword('');
              }
            }
          }
        ]
      );
    } else {
      console.log('[LoginScreen] Starting sign in...');
      const result = await signIn(email, password);
      console.log('[LoginScreen] Sign in result:', result);
      setIsLoading(false);

      if (result.success) {
        console.log('[LoginScreen] Sign in successful, waiting for profile to load...');
        // Wait a bit for the profile to load via AuthContext
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to home - the home screen will handle showing the right content
        console.log('[LoginScreen] Navigating to home...');
        router.replace('/(tabs)/(home)/');
      } else {
        console.log('[LoginScreen] Sign in failed:', result.message);
        Alert.alert('Sign In Failed', result.message);
      }
    }
  };

  const handleSubscribe = async (subscriptionType: 'monthly' | 'annual') => {
    // Check if payment system is available
    if (!isPaymentSystemAvailable()) {
      console.log('[LoginScreen] Payment system not available, checking configuration...');
      checkPaymentConfiguration();
      
      Alert.alert(
        'Payment Integration Required',
        'Subscription features are currently being configured.\n\n' +
        'To enable subscriptions, you need to integrate a payment provider:\n\n' +
        '• RevenueCat (Recommended)\n' +
        '• Stripe with WebView\n' +
        '• Create EAS Development Build with Superwall\n\n' +
        'See utils/superwallConfig.ts for detailed integration instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubscribing(true);

    try {
      const subscriptionName = subscriptionType === 'monthly' ? 'Monthly' : 'Annual';
      const subscriptionPrice = subscriptionType === 'monthly' 
        ? `$${PAYMENT_CONFIG.MONTHLY_PRICE}/month` 
        : `$${PAYMENT_CONFIG.ANNUAL_PRICE}/year`;
      
      console.log(`[LoginScreen] 🎨 Opening ${subscriptionName} paywall...`);
      
      // Set user attributes if logged in
      if (user) {
        console.log('[LoginScreen] 👤 User logged in, presenting paywall with user context');
        const result = await presentPaywall(subscriptionType, user.id, user.email || '');
        
        console.log('[LoginScreen] 📊 Paywall result:', result);
        
        if (result.state === 'purchased') {
          // Refresh profile to get updated subscription status
          await refreshProfile();
          
          Alert.alert(
            'Success! 🎉',
            `Your ${subscriptionName.toLowerCase()} subscription is now active. Enjoy exclusive content!`,
            [
              {
                text: 'OK',
                onPress: () => {
                  router.replace('/(tabs)/(home)/');
                }
              }
            ]
          );
        } else if (result.state === 'restored') {
          // Refresh profile to get updated subscription status
          await refreshProfile();
          
          Alert.alert(
            'Subscription Restored ✅',
            'Your subscription has been restored successfully!',
            [
              {
                text: 'OK',
                onPress: () => {
                  router.replace('/(tabs)/(home)/');
                }
              }
            ]
          );
        } else if (result.state === 'declined') {
          console.log('[LoginScreen] ℹ️ User declined purchase');
          // User cancelled - no need to show alert
        }
      } else {
        // User not logged in - show paywall without user context
        console.log('[LoginScreen] ⚠️ User not logged in, presenting paywall without user context');
        const result = await presentPaywall(subscriptionType);
        
        if (result.state === 'purchased' || result.state === 'restored') {
          Alert.alert(
            'Success! 🎉',
            'Please sign in or create an account to link your subscription.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error: any) {
      console.error('[LoginScreen] ❌ Payment error:', error);
      
      let errorMessage = 'Unable to process subscription at this time.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Subscription Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <IconSymbol
            ios_icon_name="xmark.circle.fill"
            android_material_icon_name="cancel"
            size={32}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Text style={[styles.appTitle, { color: colors.primary }]}>SurfVista</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isSignUp ? 'Create your account' : 'Sign in to access exclusive content'}
        </Text>

        <View style={styles.form}>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
            <IconSymbol
              ios_icon_name="envelope.fill"
              android_material_icon_name="email"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
            <IconSymbol
              ios_icon_name="lock.fill"
              android_material_icon_name="lock"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.primary }]}
            onPress={handleAuth}
            disabled={isLoading}
          >
            <Text style={styles.authButtonText}>
              {isLoading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={isLoading}
          >
            <Text style={[styles.switchModeText, { color: colors.textSecondary }]}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.textSecondary }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or subscribe</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.textSecondary }]} />
          </View>

          <View style={styles.subscriptionOptions}>
            <TouchableOpacity
              style={[styles.subscribeButton, styles.monthlyButton, { backgroundColor: colors.accent }]}
              onPress={() => handleSubscribe('monthly')}
              disabled={isSubscribing}
            >
              {isSubscribing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <React.Fragment>
                  <View style={styles.subscriptionHeader}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar_today"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.subscribeButtonTitle}>Monthly</Text>
                  </View>
                  <Text style={styles.subscribeButtonPrice}>${PAYMENT_CONFIG.MONTHLY_PRICE}/month</Text>
                  <Text style={styles.subscribeButtonDescription}>Cancel anytime</Text>
                </React.Fragment>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subscribeButton, styles.annualButton, { backgroundColor: colors.primary }]}
              onPress={() => handleSubscribe('annual')}
              disabled={isSubscribing}
            >
              {isSubscribing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <React.Fragment>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                  </View>
                  <View style={styles.subscriptionHeader}>
                    <IconSymbol
                      ios_icon_name="star.fill"
                      android_material_icon_name="star"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.subscribeButtonTitle}>Annual</Text>
                  </View>
                  <Text style={styles.subscribeButtonPrice}>${PAYMENT_CONFIG.ANNUAL_PRICE}/year</Text>
                  <Text style={styles.subscribeButtonDescription}>Save $30 per year</Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={20}
            color={colors.primary}
          />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {isSignUp 
                ? 'After signing up, you&apos;ll receive a verification email. Please verify your email before signing in.'
                : 'Subscribe to access exclusive 6K drone footage and daily surf reports from Folly Beach, SC.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  authButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchModeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  switchModeText: {
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  subscriptionOptions: {
    gap: 16,
  },
  subscribeButton: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    position: 'relative',
  },
  monthlyButton: {
    // Additional styling for monthly button
  },
  annualButton: {
    // Additional styling for annual button
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  subscribeButtonTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subscribeButtonPrice: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subscribeButtonDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
