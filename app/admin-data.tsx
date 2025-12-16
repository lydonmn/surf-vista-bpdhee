
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/app/integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function AdminDataScreen() {
  const theme = useTheme();
  const { profile, isAdmin } = useAuth();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, any>>({});

  if (!isAdmin()) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Admin Only
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            This page is only accessible to administrators
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const updateData = async (functionName: string, displayName: string) => {
    setIsUpdating(functionName);
    try {
      console.log(`Calling ${functionName}...`);
      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) {
        console.error(`Error calling ${functionName}:`, error);
        Alert.alert('Error', `Failed to update ${displayName}: ${error.message}`);
        setLastResults(prev => ({
          ...prev,
          [functionName]: { success: false, error: error.message }
        }));
      } else {
        console.log(`${functionName} result:`, data);
        Alert.alert('Success', `${displayName} updated successfully!`);
        setLastResults(prev => ({
          ...prev,
          [functionName]: { success: true, data }
        }));
      }
    } catch (error) {
      console.error(`Exception calling ${functionName}:`, error);
      Alert.alert('Error', `Failed to update ${displayName}`);
      setLastResults(prev => ({
        ...prev,
        [functionName]: { success: false, error: String(error) }
      }));
    } finally {
      setIsUpdating(null);
    }
  };

  const updateAllData = async () => {
    setIsUpdating('all');
    try {
      console.log('Updating all data...');
      
      // Call all functions in sequence
      const weatherResult = await supabase.functions.invoke('fetch-weather-data');
      if (weatherResult.error) throw new Error('Weather update failed');
      
      const tideResult = await supabase.functions.invoke('fetch-tide-data');
      if (tideResult.error) throw new Error('Tide update failed');
      
      const surfResult = await supabase.functions.invoke('fetch-surf-reports');
      if (surfResult.error) throw new Error('Surf report update failed');
      
      const reportResult = await supabase.functions.invoke('generate-daily-report');
      if (reportResult.error) throw new Error('Daily report generation failed');

      Alert.alert('Success', 'All data updated successfully!');
      setLastResults({
        'fetch-weather-data': { success: true, data: weatherResult.data },
        'fetch-tide-data': { success: true, data: tideResult.data },
        'fetch-surf-reports': { success: true, data: surfResult.data },
        'generate-daily-report': { success: true, data: reportResult.data },
      });
    } catch (error) {
      console.error('Error updating all data:', error);
      Alert.alert('Error', `Failed to update all data: ${error}`);
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow_back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Data Management
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Manually trigger data updates
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Update All Data
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Fetch weather, tides, surf reports, and generate daily report
        </Text>
        <TouchableOpacity
          style={[
            styles.updateButton,
            { backgroundColor: colors.accent },
            isUpdating === 'all' && styles.disabledButton
          ]}
          onPress={updateAllData}
          disabled={isUpdating !== null}
        >
          {isUpdating === 'all' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.updateButtonText}>Update All</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Individual Updates
        </Text>
        
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.individualButton,
              { backgroundColor: colors.primary },
              isUpdating === 'fetch-weather-data' && styles.disabledButton
            ]}
            onPress={() => updateData('fetch-weather-data', 'Weather Data')}
            disabled={isUpdating !== null}
          >
            {isUpdating === 'fetch-weather-data' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="cloud.sun.fill"
                  android_material_icon_name="wb_sunny"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.individualButtonText}>Update Weather</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.individualButton,
              { backgroundColor: colors.primary },
              isUpdating === 'fetch-tide-data' && styles.disabledButton
            ]}
            onPress={() => updateData('fetch-tide-data', 'Tide Data')}
            disabled={isUpdating !== null}
          >
            {isUpdating === 'fetch-tide-data' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.up.arrow.down"
                  android_material_icon_name="swap_vert"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.individualButtonText}>Update Tides</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.individualButton,
              { backgroundColor: colors.primary },
              isUpdating === 'fetch-surf-reports' && styles.disabledButton
            ]}
            onPress={() => updateData('fetch-surf-reports', 'Surf Reports')}
            disabled={isUpdating !== null}
          >
            {isUpdating === 'fetch-surf-reports' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="water.waves"
                  android_material_icon_name="waves"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.individualButtonText}>Update Surf</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.individualButton,
              { backgroundColor: colors.primary },
              isUpdating === 'generate-daily-report' && styles.disabledButton
            ]}
            onPress={() => updateData('generate-daily-report', 'Daily Report')}
            disabled={isUpdating !== null}
          >
            {isUpdating === 'generate-daily-report' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="doc.text.fill"
                  android_material_icon_name="description"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.individualButtonText}>Generate Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {Object.keys(lastResults).length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Last Results
          </Text>
          {Object.entries(lastResults).map(([key, result]) => (
            <View key={key} style={styles.resultItem}>
              <IconSymbol
                ios_icon_name={result.success ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
                android_material_icon_name={result.success ? 'check_circle' : 'error'}
                size={20}
                color={result.success ? '#4CAF50' : '#F44336'}
              />
              <Text style={[styles.resultText, { color: theme.colors.text }]}>
                {key}: {result.success ? 'Success' : 'Failed'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={24}
          color={colors.primary}
        />
        <View style={styles.infoTextContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Data is automatically updated daily at 6:00 AM EST via a cron job. Use these manual controls for testing or immediate updates.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonGroup: {
    gap: 12,
  },
  individualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  individualButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  resultText: {
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
