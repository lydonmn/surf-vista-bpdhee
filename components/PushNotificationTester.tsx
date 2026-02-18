
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/app/integrations/supabase/client';

export function PushNotificationTester() {
  const { user, profile } = useAuth();
  const [isTesting, setIsTesting] = useState(false);

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

      if (userProfile.push_token === 'web-dummy-token' || userProfile.push_token === 'simulator-dummy-token') {
        Alert.alert(
          'Invalid Token',
          `Your push token is a ${userProfile.push_token === 'web-dummy-token' ? 'web' : 'simulator'} dummy token.\n\nPush notifications only work on physical devices with EAS builds (TestFlight or App Store).`,
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
});
