
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/app/integrations/supabase/client';

export function PushNotificationTester() {
  const { user, profile } = useAuth();
  const [isTesting, setIsTesting] = useState(false);
  
  // Check if running on web or simulator
  const isWebOrSimulator = Platform.OS === 'web' || !Device.isDevice;

  const handleTestNotification = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user signed in');
      return;
    }

    console.log('[PushNotificationTester] ===== TESTING PUSH NOTIFICATION =====');
    setIsTesting(true);

    try {
      // Fetch user's push token
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('push_token, email')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        console.error('[PushNotificationTester] Error fetching profile:', profileError);
        Alert.alert('Error', 'Failed to fetch user profile');
        setIsTesting(false);
        return;
      }

      console.log('[PushNotificationTester] User email:', userProfile.email);
      console.log('[PushNotificationTester] Push token:', userProfile.push_token);

      if (!userProfile.push_token) {
        Alert.alert(
          'No Push Token',
          'You don\'t have a push token registered. Please:\n\n1. Enable notifications in Profile tab\n2. Grant iOS notification permissions\n3. Make sure you\'re using a TestFlight or App Store build (not Expo Go)',
          [{ text: 'OK' }]
        );
        setIsTesting(false);
        return;
      }

      // ✅ V10.2 CRITICAL FIX: Validate token format
      if (!userProfile.push_token.startsWith('ExponentPushToken[')) {
        console.error('[PushNotificationTester] ❌ Invalid token format:', userProfile.push_token);
        Alert.alert(
          'Invalid Token',
          `Your push token has an invalid format.\n\nToken: ${userProfile.push_token}\n\nThis usually means:\n- You're on web or simulator\n- The token wasn't registered correctly\n\nPlease disable and re-enable notifications in the Profile tab on a physical device.`,
          [{ text: 'OK' }]
        );
        setIsTesting(false);
        return;
      }

      // Send test notification via Expo Push API
      console.log('[PushNotificationTester] Sending test notification...');
      
      const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
      const message = {
        to: userProfile.push_token,
        sound: 'default',
        title: '🧪 Test Notification',
        body: 'This is a test notification from SurfVista. If you see this, push notifications are working! 🎉',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
        priority: 'high',
        channelId: 'daily-reports',
      };

      const response = await fetch(expoPushUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([message]),
      });

      const result = await response.json();
      console.log('[PushNotificationTester] Result:', result);

      if (result.data && result.data[0]?.status === 'ok') {
        console.log('[PushNotificationTester] ✅ Test notification sent successfully');
        Alert.alert(
          'Test Sent! 🎉',
          'A test notification has been sent to your device. You should receive it within a few seconds.\n\nIf you don\'t see it, check:\n1. iOS notification settings\n2. Do Not Disturb is off\n3. App is not in foreground (notifications show when app is closed or in background)',
          [{ text: 'OK' }]
        );
      } else {
        const errorMsg = result.data?.[0]?.details?.error || result.data?.[0]?.message || 'Unknown error';
        console.error('[PushNotificationTester] ❌ Test notification failed:', errorMsg);
        Alert.alert(
          'Test Failed',
          `Failed to send test notification:\n\n${errorMsg}\n\nThis usually means:\n- Invalid push token\n- Token expired\n- Device not registered with Expo`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[PushNotificationTester] ❌ Exception:', error);
      Alert.alert(
        'Error',
        `An error occurred while testing:\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsTesting(false);
    }
  };

  if (!profile?.is_admin) {
    return null;
  }

  // Show different UI for web/simulator
  if (isWebOrSimulator) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={24}
            color="#F59E0B"
          />
          <Text style={styles.title}>Push Notification Tester</Text>
        </View>
        
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Physical Device Required</Text>
          <Text style={styles.warningText}>
            Push notifications only work on physical devices with EAS builds (TestFlight or App Store).
          </Text>
          <Text style={styles.warningText}>
            You are currently running on {Platform.OS === 'web' ? 'web' : 'a simulator'}, where push notifications are not available.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>To test push notifications:</Text>
          <Text style={styles.infoText}>1. Build the app with EAS Build</Text>
          <Text style={styles.infoText}>2. Install on a physical iOS or Android device</Text>
          <Text style={styles.infoText}>3. Enable notifications in Profile tab</Text>
          <Text style={styles.infoText}>4. Return to this screen to send a test</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="bell.badge.fill"
          android_material_icon_name="notifications_active"
          size={24}
          color={colors.primary}
        />
        <Text style={styles.title}>Push Notification Tester</Text>
      </View>
      
      <Text style={styles.description}>
        Send a test notification to yourself to verify push notifications are working correctly.
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleTestNotification}
        disabled={isTesting}
      >
        {isTesting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <IconSymbol
              ios_icon_name="paperplane.fill"
              android_material_icon_name="send"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Send Test Notification</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        Note: You must have notifications enabled in your Profile tab and have granted iOS notification permissions for this to work.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 6,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
});
