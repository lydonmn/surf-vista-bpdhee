
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/app/integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@react-navigation/native';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] Processing email verification callback');
      console.log('[AuthCallback] Params:', params);

      try {
        // Extract token from URL params
        const token = params.token as string;
        const type = params.type as string;

        if (!token) {
          console.error('[AuthCallback] No token found in URL');
          setStatus('error');
          setMessage('Invalid verification link. Please try again or request a new verification email.');
          setTimeout(() => router.replace('/login'), 3000);
          return;
        }

        console.log('[AuthCallback] Token found, verifying...');

        // Verify the email using the token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type === 'recovery' ? 'recovery' : 'email',
        });

        if (error) {
          console.error('[AuthCallback] Verification error:', error);
          
          // Check if it's already verified
          if (error.message.includes('already been verified') || error.message.includes('Token has expired')) {
            setStatus('success');
            setMessage('✅ Email already verified! Redirecting to login...');
            setTimeout(() => router.replace('/login'), 2000);
            return;
          }

          setStatus('error');
          setMessage(`Verification failed: ${error.message}`);
          setTimeout(() => router.replace('/login'), 3000);
          return;
        }

        console.log('[AuthCallback] ✅ Email verified successfully');
        setStatus('success');
        setMessage('✅ Email verified successfully! Redirecting to home...');

        // If user is now signed in, go to home, otherwise go to login
        if (data.session) {
          console.log('[AuthCallback] User signed in, redirecting to home');
          setTimeout(() => router.replace('/(tabs)/(home)'), 2000);
        } else {
          console.log('[AuthCallback] User not signed in, redirecting to login');
          setTimeout(() => router.replace('/login'), 2000);
        }
      } catch (error: any) {
        console.error('[AuthCallback] Exception:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
        setTimeout(() => router.replace('/login'), 3000);
      }
    };

    handleCallback();
  }, [params, router]);

  const statusIconName = status === 'loading' 
    ? 'hourglass_empty' 
    : status === 'success' 
    ? 'check_circle' 
    : 'error';

  const statusColor = status === 'loading'
    ? colors.primary
    : status === 'success'
    ? '#4CAF50'
    : '#F44336';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {status === 'loading' && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        )}
        
        <View style={[styles.iconContainer, { backgroundColor: `${statusColor}20` }]}>
          <IconSymbol
            ios_icon_name={status === 'loading' ? 'hourglass' : status === 'success' ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
            android_material_icon_name={statusIconName}
            size={64}
            color={statusColor}
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          {status === 'loading' ? 'Verifying Email' : status === 'success' ? 'Success!' : 'Verification Failed'}
        </Text>

        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>

        {status === 'success' && (
          <View style={[styles.successBox, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: '#4CAF50' }]}>
            <IconSymbol
              ios_icon_name="checkmark.seal.fill"
              android_material_icon_name="verified"
              size={24}
              color="#4CAF50"
            />
            <Text style={[styles.successText, { color: theme.colors.text }]}>
              Your email has been verified. You can now sign in and access all features.
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={[styles.errorBox, { backgroundColor: 'rgba(244, 67, 54, 0.1)', borderColor: '#F44336' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={24}
              color="#F44336"
            />
            <Text style={[styles.errorText, { color: theme.colors.text }]}>
              If you continue to have issues, please try requesting a new verification email from the login screen.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
