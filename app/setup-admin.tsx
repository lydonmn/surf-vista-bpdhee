
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { router } from "expo-router";
import { supabase } from "@/app/integrations/supabase/client";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";

export default function SetupAdminScreen() {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const setupAdmin = async () => {
    setIsLoading(true);
    try {
      console.log('Calling create-admin Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {}
      });

      if (error) {
        console.error('Error calling function:', error);
        Alert.alert('Setup Failed', error.message || 'Failed to create admin user');
        return;
      }

      console.log('Admin setup response:', data);

      if (data.success) {
        setSetupComplete(true);
        Alert.alert(
          'Success!',
          `Admin account has been created successfully!\n\nEmail: ${data.email}\nPassword: Federalreserve69$\n\nYou can now sign in with these credentials.`,
          [
            {
              text: 'Go to Login',
              onPress: () => router.replace('/login')
            }
          ]
        );
      } else {
        Alert.alert('Setup Failed', data.error || 'Failed to create admin user');
      }
    } catch (error: any) {
      console.error('Setup error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <IconSymbol
            ios_icon_name="person.badge.key.fill"
            android_material_icon_name="admin_panel_settings"
            size={80}
            color={colors.primary}
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Admin Account Setup
        </Text>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          This will create the admin account for SurfVista with the following credentials:
        </Text>

        <View style={[styles.credentialsCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.credentialRow}>
            <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>
              Email:
            </Text>
            <Text style={[styles.credentialValue, { color: theme.colors.text }]}>
              lydonmn@gmail.com
            </Text>
          </View>
          <View style={styles.credentialRow}>
            <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>
              Password:
            </Text>
            <Text style={[styles.credentialValue, { color: theme.colors.text }]}>
              Federalreserve69$
            </Text>
          </View>
        </View>

        {!setupComplete && (
          <>
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.primary, opacity: isLoading ? 0.6 : 1 }]}
              onPress={setupAdmin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check_circle"
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.setupButtonText}>
                    Create Admin Account
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={isLoading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </>
        )}

        {setupComplete && (
          <View style={[styles.successCard, { backgroundColor: colors.highlight }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check_circle"
              size={32}
              color={colors.primary}
            />
            <Text style={[styles.successText, { color: theme.colors.text }]}>
              Admin account created successfully!
            </Text>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            This setup only needs to be run once. If the account already exists, it will update the password.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  credentialsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  credentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  credentialLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  credentialValue: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    gap: 12,
    marginTop: 'auto',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
