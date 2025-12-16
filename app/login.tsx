
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

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
        console.log('[LoginScreen] Sign in successful, navigating to home...');
        // Use replace to prevent back navigation to login
        router.replace('/(tabs)/(home)/');
      } else {
        console.log('[LoginScreen] Sign in failed:', result.message);
        Alert.alert('Sign In Failed', result.message);
      }
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
              {isSignUp ? 'Already have an account? ' : 'Don&apos;t have an account? '}
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.textSecondary }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.textSecondary }]} />
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              console.log('[LoginScreen] Opening subscription flow');
              Alert.alert(
                'Subscribe to SurfVista',
                'Get unlimited access to exclusive drone footage and daily surf reports for just $5/month.\n\nPayment integration coming soon with Superwall!'
              );
            }}
          >
            <Text style={styles.subscribeButtonText}>Subscribe Now - $5/month</Text>
          </TouchableOpacity>
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
                : 'New users need to verify their email address before accessing the app.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.adminSetupButton, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/setup-admin')}
        >
          <IconSymbol
            ios_icon_name="person.badge.key.fill"
            android_material_icon_name="admin_panel_settings"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.adminSetupText, { color: colors.primary }]}>
            First Time Setup - Create Admin Account
          </Text>
        </TouchableOpacity>
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
  subscribeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  adminSetupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  adminSetupText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
