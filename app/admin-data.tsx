
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDataScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const handleFetchWeather = async () => {
    try {
      setLoading('weather');
      addLog('Fetching weather data...');
      
      const { data, error } = await supabase.functions.invoke('fetch-weather-data');
      
      if (error) {
        addLog(`Error: ${error.message}`);
        Alert.alert('Error', `Failed to fetch weather data: ${error.message}`);
      } else {
        addLog(`Success! Weather data updated. Forecast records: ${data.forecast_count}`);
        Alert.alert('Success', 'Weather data and forecast updated successfully!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Exception: ${message}`);
      Alert.alert('Error', message);
    } finally {
      setLoading(null);
    }
  };

  const handleFetchTides = async () => {
    try {
      setLoading('tides');
      addLog('Fetching tide data...');
      
      const { data, error } = await supabase.functions.invoke('fetch-tide-data');
      
      if (error) {
        addLog(`Error: ${error.message}`);
        Alert.alert('Error', `Failed to fetch tide data: ${error.message}`);
      } else {
        addLog(`Success! ${data.count} tide records stored.`);
        Alert.alert('Success', `${data.count} tide records updated successfully!`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Exception: ${message}`);
      Alert.alert('Error', message);
    } finally {
      setLoading(null);
    }
  };

  const handleFetchSurf = async () => {
    try {
      setLoading('surf');
      addLog('Fetching surf report data...');
      
      const { data, error } = await supabase.functions.invoke('fetch-surf-reports');
      
      if (error) {
        addLog(`Error: ${error.message}`);
        Alert.alert('Error', `Failed to fetch surf data: ${error.message}`);
      } else {
        addLog('Success! Surf report data updated.');
        Alert.alert('Success', 'Surf report data updated successfully!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Exception: ${message}`);
      Alert.alert('Error', message);
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setLoading('report');
      addLog('Generating daily surf report...');
      
      const { data, error } = await supabase.functions.invoke('generate-daily-report');
      
      if (error) {
        addLog(`Error: ${error.message}`);
        Alert.alert('Error', `Failed to generate report: ${error.message}`);
      } else {
        addLog('Success! Daily surf report generated.');
        Alert.alert('Success', 'Daily surf report generated successfully!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Exception: ${message}`);
      Alert.alert('Error', message);
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateAll = async () => {
    try {
      setLoading('all');
      addLog('Starting full data update...');
      
      // Fetch weather and forecast
      addLog('Step 1/4: Fetching weather data...');
      const weatherResponse = await supabase.functions.invoke('fetch-weather-data');
      if (weatherResponse.error) {
        throw new Error(`Weather: ${weatherResponse.error.message}`);
      }
      addLog(`✓ Weather data updated (${weatherResponse.data.forecast_count} forecast records)`);
      
      // Fetch tides
      addLog('Step 2/4: Fetching tide data...');
      const tideResponse = await supabase.functions.invoke('fetch-tide-data');
      if (tideResponse.error) {
        throw new Error(`Tides: ${tideResponse.error.message}`);
      }
      addLog(`✓ Tide data updated (${tideResponse.data.count} records)`);
      
      // Fetch surf reports
      addLog('Step 3/4: Fetching surf report data...');
      const surfResponse = await supabase.functions.invoke('fetch-surf-reports');
      if (surfResponse.error) {
        throw new Error(`Surf: ${surfResponse.error.message}`);
      }
      addLog('✓ Surf report data updated');
      
      // Generate daily report
      addLog('Step 4/4: Generating daily report...');
      const reportResponse = await supabase.functions.invoke('generate-daily-report');
      if (reportResponse.error) {
        throw new Error(`Report: ${reportResponse.error.message}`);
      }
      addLog('✓ Daily surf report generated');
      
      addLog('=== ALL DATA UPDATED SUCCESSFULLY ===');
      Alert.alert('Success', 'All data has been updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`FAILED: ${message}`);
      Alert.alert('Error', `Update failed: ${message}`);
    } finally {
      setLoading(null);
    }
  };

  if (!profile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Admin access required
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow_back"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Data Management
          </Text>
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
              styles.button,
              { backgroundColor: colors.accent },
              loading === 'all' && styles.buttonDisabled
            ]}
            onPress={handleUpdateAll}
            disabled={loading !== null}
          >
            {loading === 'all' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Update All Data</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Individual Updates
          </Text>
          
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              loading === 'weather' && styles.buttonDisabled
            ]}
            onPress={handleFetchWeather}
            disabled={loading !== null}
          >
            {loading === 'weather' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="cloud.sun.fill"
                  android_material_icon_name="wb_sunny"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Fetch Weather & Forecast</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              loading === 'tides' && styles.buttonDisabled
            ]}
            onPress={handleFetchTides}
            disabled={loading !== null}
          >
            {loading === 'tides' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="arrow.up.arrow.down"
                  android_material_icon_name="swap_vert"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Fetch Tide Data</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              loading === 'surf' && styles.buttonDisabled
            ]}
            onPress={handleFetchSurf}
            disabled={loading !== null}
          >
            {loading === 'surf' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="water.waves"
                  android_material_icon_name="waves"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Fetch Surf Reports</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              loading === 'report' && styles.buttonDisabled
            ]}
            onPress={handleGenerateReport}
            disabled={loading !== null}
          >
            {loading === 'report' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="doc.text.fill"
                  android_material_icon_name="description"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Generate Daily Report</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>

        {logs.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={styles.logsHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Activity Log
              </Text>
              <TouchableOpacity onPress={() => setLogs([])}>
                <Text style={[styles.clearButton, { color: colors.primary }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.logsContainer}>
              {logs.map((log, index) => (
                <Text
                  key={index}
                  style={[styles.logText, { color: colors.textSecondary }]}
                >
                  {log}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  title: {
    fontSize: 28,
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  logsContainer: {
    maxHeight: 300,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 18,
  },
});
