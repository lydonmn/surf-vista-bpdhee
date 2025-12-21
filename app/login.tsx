
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, signUp, user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      console.log('[LoginScreen] User already logged in, redirecting to home');
      router.replace('/(tabs)');
    }
  }, [user, authLoading]);

  const handleResendConfirmation = async () => {
    if (!resendEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resendEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[LoginScreen] Resending confirmation email to:', resendEmail);
      
      // Use 'signup' type for resending confirmation emails
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
        options: {
          emailRedirectTo: 'https://natively.dev/email-confirmed'
        }
      });

      if (error) {
        console.error('[LoginScreen] Resend error:', error);
        Alert.alert('Error', error.message || 'Failed to resend confirmation email');
      } else {
        console.log('[LoginScreen] Resend successful:', data);
        Alert.alert(
          'Email Sent!',
          'A new confirmation email has been sent. Please check your inbox and spam folder.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowResendEmail(false);
                setResendEmail('');
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('[LoginScreen] Resend exception:', error);
      Alert.alert('Error', error.message || 'Failed to resend confirmation email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Password length validation
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        console.log('[LoginScreen] Attempting sign up...');
        const result = await signUp(email, password);
        
        if (result.success) {
          Alert.alert(
            'Success!',
            result.message + '\n\n⚠️ Important: Please check your spam/junk folder if you don\'t see the email within a few minutes.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // If email confirmation is required, switch to sign in mode
                  if (result.message.includes('verify your email')) {
                    setIsSignUp(false);
                    setPassword('');
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('Sign Up Failed', result.message);
        }
      } else {
        console.log('[LoginScreen] Attempting sign in...');
        const result = await signIn(email, password);
        
        if (result.success) {
          console.log('[LoginScreen] Sign in successful, navigating to home');
          router.replace('/(tabs)');
        } else {
          // Check if it's an email not confirmed error
          if (result.message.includes('verify your email') || result.message.includes('Email not confirmed')) {
            Alert.alert(
              'Email Not Verified',
              'Please verify your email address before signing in. Check your inbox and spam folder for the confirmation email.',
              [
                {
                  text: 'Resend Email',
                  onPress: () => {
                    setResendEmail(email);
                    setShowResendEmail(true);
                  }
                },
                {
                  text: 'OK',
                  style: 'cancel'
                }
              ]
            );
          } else {
            Alert.alert('Sign In Failed', result.message);
          }
        }
      }
    } catch (error: any) {
      console.error('[LoginScreen] Error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setPassword('');
    setShowResendEmail(false);
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Resend confirmation email view
  if (showResendEmail) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
                <IconSymbol
                  ios_icon_name="envelope.badge.fill"
                  android_material_icon_name="mark_email_read"
                  size={64}
                  color="#FFFFFF"
                />
              </View>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Resend Confirmation
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter your email to receive a new confirmation link
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
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
                  value={resendEmail}
                  onChangeText={setResendEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isLoading}
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  isLoading && styles.submitButtonDisabled
                ]}
                onPress={handleResendConfirmation}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    Resend Confirmation Email
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => {
                  setShowResendEmail(false);
                  setResendEmail('');
                }}
                disabled={isLoading}
              >
                <Text style={[styles.toggleButtonText, { color: colors.primary }]}>
                  Back to Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Info */}
            <View style={[styles.noticeContainer, { backgroundColor: 'rgba(70, 130, 180, 0.15)' }]}>
              <IconSymbol
                ios_icon_name="info.circle.fill"
                android_material_icon_name="info"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.noticeText, { color: theme.colors.text }]}>
                Make sure to check your spam/junk folder. Confirmation emails sometimes end up there.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
              <IconSymbol
                ios_icon_name="water.waves"
                android_material_icon_name="waves"
                size={64}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              SurfVista
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Folly Beach, SC
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: theme.colors.text }]}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            
            <View style={styles.inputContainer}>
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
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
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
                editable={!isLoading}
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                isLoading && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={toggleMode}
              disabled={isLoading}
            >
              <Text style={[styles.toggleButtonText, { color: colors.primary }]}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : 'Don\'t have an account? Sign Up'}
              </Text>
            </TouchableOpacity>

            {/* Resend confirmation link */}
            {!isSignUp && (
              <TouchableOpacity
                style={[styles.toggleButton, { marginTop: 8 }]}
                onPress={() => setShowResendEmail(true)}
                disabled={isLoading}
              >
                <Text style={[styles.resendLinkText, { color: colors.textSecondary }]}>
                  Didn&apos;t receive confirmation email?
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Subscribe for $10.99/month or $100.99/year to access exclusive surf reports and drone footage
            </Text>
          </View>

          {/* Email Verification Notice */}
          {isSignUp && (
            <View style={[styles.noticeContainer, { backgroundColor: 'rgba(70, 130, 180, 0.15)' }]}>
              <IconSymbol
                ios_icon_name="envelope.badge.fill"
                android_material_icon_name="mark_email_read"
                size={20}
                color={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeText, { color: theme.colors.text, marginBottom: 8 }]}>
                  After signing up, you&apos;ll receive a verification email. Please verify your email before signing in.
                </Text>
                <Text style={[styles.noticeText, { color: theme.colors.text, fontSize: 12, fontStyle: 'italic' }]}>
                  💡 Tip: Check your spam/junk folder if you don&apos;t see the email within a few minutes.
                </Text>
              </View>
            </View>
          )}
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
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(70, 130, 180, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendLinkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: 'rgba(70, 130, 180, 0.1)',
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(70, 130, 180, 0.3)',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
