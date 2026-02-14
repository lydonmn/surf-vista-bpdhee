
import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@react-navigation/native';

export default function VerificationSuccessScreen() {
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    console.log('[VerificationSuccess] User landed on verification success page');
  }, []);

  const handleContinue = () => {
    console.log('[VerificationSuccess] User tapped Continue to Login');
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
          <IconSymbol
            ios_icon_name="checkmark.circle.fill"
            android_material_icon_name="check_circle"
            size={80}
            color="#4CAF50"
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Email Verified! ✅
        </Text>

        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Your email has been successfully verified. You can now sign in to access all SurfVista features.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: 'rgba(70, 130, 180, 0.1)', borderColor: colors.primary }]}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
              What&apos;s Next?
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              1. Sign in with your email and password
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              2. Subscribe to access exclusive surf reports
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              3. Enjoy 6K drone footage and daily forecasts
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>
            Continue to Sign In
          </Text>
          <IconSymbol
            ios_icon_name="arrow.right"
            android_material_icon_name="arrow_forward"
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
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
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
    width: '100%',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
