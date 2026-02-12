
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface PushNotificationDebuggerProps {
  userId: string;
  userEmail: string;
}

export function PushNotificationDebugger({ userId, userEmail }: PushNotificationDebuggerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      console.log('[Push Debug] Running diagnostics for user:', userEmail);

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        Alert.alert('Error', 'Failed to fetch user profile: ' + profileError.message);
        return;
      }

      const diagnostics = {
        email: userEmail,
        notificationsEnabled: profile.daily_report_notifications || false,
        hasPushToken: !!profile.push_token,
        pushToken: profile.push_token || 'None',
        notificationLocations: profile.notification_locations || [],
        isAdmin: profile.is_admin || false,
        tokenType: !profile.push_token 
          ? 'Missing' 
          : profile.push_token === 'web-dummy-token' 
            ? 'Web (dummy)' 
            : profile.push_token === 'simulator-dummy-token'
              ? 'Simulator (dummy)'
              : profile.push_token.startsWith('ExponentPushToken')
                ? 'Valid Expo Token'
                : 'Unknown',
      };

      setDebugInfo(diagnostics);

      // Show detailed alert
      const tokenStatus = diagnostics.hasPushToken 
        ? `✅ Token: ${diagnostics.tokenType}\n${diagnostics.pushToken.substring(0, 40)}...`
        : '❌ No push token registered';

      const locationStatus = diagnostics.notificationLocations.length > 0
        ? `✅ Locations: ${diagnostics.notificationLocations.join(', ')}`
        : '⚠️ No locations selected (defaults to all)';

      Alert.alert(
        'Push Notification Diagnostics',
        `User: ${userEmail}\n\n` +
        `Notifications: ${diagnostics.notificationsEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
        `${tokenStatus}\n\n` +
        `${locationStatus}\n\n` +
        `Admin: ${diagnostics.isAdmin ? 'Yes' : 'No'}\n\n` +
        (diagnostics.hasPushToken && diagnostics.tokenType === 'Valid Expo Token'
          ? '✅ This user should receive notifications'
          : '⚠️ This user will NOT receive notifications until they register a push token on a physical device with an EAS build'),
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('[Push Debug] Error:', error);
      Alert.alert('Error', error.message || 'Failed to run diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setIsLoading(true);
    try {
      console.log('[Push Debug] Sending test notification to:', userEmail);

      // Fetch user profile to get push token
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.push_token) {
        Alert.alert(
          'Cannot Send Test',
          'This user does not have a valid push token registered. They need to:\n\n1. Install an EAS build on a physical device\n2. Sign in to the app\n3. Enable notifications in Profile settings'
        );
        return;
      }

      if (profile.push_token === 'web-dummy-token' || profile.push_token === 'simulator-dummy-token') {
        Alert.alert(
          'Cannot Send Test',
          'This user has a dummy token (web or simulator). Push notifications only work on physical devices with EAS builds.'
        );
        return;
      }

      // Send test notification via Expo Push API
      const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
      const message = {
        to: profile.push_token,
        sound: 'default',
        title: '🧪 Test Notification',
        body: 'This is a test notification from SurfVista admin panel. If you see this, push notifications are working!',
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
      console.log('[Push Debug] Test notification result:', result);

      if (result.data && result.data[0]?.status === 'ok') {
        Alert.alert(
          'Test Notification Sent! ✅',
          `A test notification has been sent to ${userEmail}. Check the device to confirm it was received.`
        );
      } else {
        Alert.alert(
          'Send Failed',
          `Failed to send test notification:\n\n${JSON.stringify(result.data?.[0]?.details || result, null, 2)}`
        );
      }

    } catch (error: any) {
      console.error('[Push Debug] Error sending test:', error);
      Alert.alert('Error', error.message || 'Failed to send test notification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="bell.badge.fill"
          android_material_icon_name="notifications_active"
          size={24}
          color={colors.primary}
        />
        <Text style={styles.headerText}>
          Push Notification Tools
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={runDiagnostics}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="stethoscope"
                android_material_icon_name="bug_report"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>
                Run Diagnostics
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#10B981' }]}
          onPress={sendTestNotification}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="paperplane.fill"
                android_material_icon_name="send"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>
                Send Test
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {debugInfo && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugTitle}>
            Last Diagnostic Results:
          </Text>
          <Text style={styles.debugText}>
            Notifications: {debugInfo.notificationsEnabled ? '✅ Enabled' : '❌ Disabled'}
          </Text>
          <Text style={styles.debugText}>
            Push Token: {debugInfo.hasPushToken ? `✅ ${debugInfo.tokenType}` : '❌ Missing'}
          </Text>
          <Text style={styles.debugText}>
            Locations: {debugInfo.notificationLocations.join(', ') || 'All'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(70, 130, 180, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
});
