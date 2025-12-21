
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';

interface DataCounts {
  tides: number;
  weather: number;
  forecast: number;
  surf: number;
  external: number;
}

interface ActivityLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function AdminDataScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setActivityLog(prev => [{ timestamp, message, type }, ...prev].slice(0, 50));
  };

  const loadDataCounts = async () => {
    try {
      addLog('Loading data counts...');
      
      // Get current date in EST
      const now = new Date();
      const estDateString = now.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const [month, day, year] = estDateString.split('/');
      const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      const [tidesResult, weatherResult, forecastResult, surfResult, externalResult] = await Promise.all([
        supabase.from('tide_data').select('id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('weather_data').select('id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('weather_forecast').select('id', { count: 'exact', head: true }),
        supabase.from('surf_conditions').select('id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('external_surf_reports').select('id', { count: 'exact', head: true }).eq('date', today),
      ]);

      setDataCounts({
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
        external: externalResult.count || 0,
      });

      addLog(`Data counts loaded: Tides=${tidesResult.count}, Weather=${weatherResult.count}, Forecast=${forecastResult.count}, Surf=${surfResult.count}, External=${externalResult.count}`, 'success');
    } catch (error) {
      console.error('Error loading data counts:', error);
      addLog(`Error loading data counts: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  useEffect(() => {
    loadDataCounts();
  }, []);

  const handleUpdateAll = async () => {
    setIsLoading(true);
    addLog('Starting data update...');

    try {
      const response = await supabase.functions.invoke('update-all-surf-data');
      
      console.log('Update response:', response);
      addLog(`Update response received: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`Error: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      } else if (response.data) {
        if (response.data.success) {
          addLog('✅ All data updated successfully!', 'success');
          
          // Show detailed results
          if (response.data.results) {
            const results = response.data.results;
            if (results.weather?.success) {
              addLog(`✅ Weather fetch successful: ${results.weather.message || 'OK'}`, 'success');
            } else if (results.weather) {
              addLog(`❌ Weather fetch failed: ${results.weather.error}`, 'error');
            }
            
            if (results.tide?.success) {
              addLog(`✅ Tide fetch successful: ${results.tide.count || 0} records`, 'success');
            } else if (results.tide) {
              addLog(`❌ Tide fetch failed: ${results.tide.error}`, 'error');
            }
            
            if (results.surf?.success) {
              addLog(`✅ Surf fetch successful: Found ${results.surf.data?.wave_height || 'N/A'}`, 'success');
            } else if (results.surf) {
              addLog(`❌ Surf fetch failed: ${results.surf.error}`, 'error');
            }
            
            if (results.report?.success) {
              addLog(`✅ Report generation successful`, 'success');
            } else if (results.report) {
              addLog(`⚠️ Report generation: ${results.report.error}`, 'info');
            }
          }
          
          Alert.alert('Success', response.data.message || 'Data updated successfully');
          await loadDataCounts();
        } else {
          const errorMsg = response.data.error || 'Update failed';
          const errors = response.data.errors || [];
          const fullError = errors.length > 0 ? `${errorMsg}: ${errors.join(', ')}` : errorMsg;
          
          addLog(`❌ Update failed: ${fullError}`, 'error');
          
          // Show detailed error breakdown
          if (response.data.results) {
            const results = response.data.results;
            if (results.weather && !results.weather.success) {
              addLog(`❌ Weather: ${results.weather.error || 'Unknown error'}`, 'error');
            }
            if (results.tide && !results.tide.success) {
              addLog(`❌ Tide: ${results.tide.error || 'Unknown error'}`, 'error');
            }
            if (results.surf && !results.surf.success) {
              addLog(`❌ Surf: ${results.surf.error || 'Unknown error'}`, 'error');
            }
            if (results.report && !results.report.success) {
              addLog(`⚠️ Report: ${results.report.error || 'Unknown error'}`, 'info');
            }
          }
          
          Alert.alert('Update Failed', fullError);
        }
      }
    } catch (error) {
      console.error('Error updating data:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to update data: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchWeather = async () => {
    setIsLoading(true);
    addLog('Fetching weather data for Folly Beach, SC...');

    try {
      const response = await supabase.functions.invoke('fetch-weather-data');
      
      console.log('Weather response:', response);
      addLog(`Weather response: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Weather error: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      } else if (response.data?.success) {
        addLog(`✅ Weather fetch successful: ${response.data.forecast_count || 0} forecast periods`, 'success');
        Alert.alert('Success', response.data.message || 'Weather data fetched successfully');
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch weather data';
        addLog(`❌ Weather failed: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Weather exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to fetch weather: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchTides = async () => {
    setIsLoading(true);
    addLog('Fetching tide data for Folly Beach, SC...');

    try {
      const response = await supabase.functions.invoke('fetch-tide-data');
      
      console.log('Tide response:', response);
      addLog(`Tide response: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Tide error: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      } else if (response.data?.success) {
        addLog(`✅ Tide fetch successful: ${response.data.count || 0} records`, 'success');
        Alert.alert('Success', response.data.message || 'Tide data fetched successfully');
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch tide data';
        addLog(`❌ Tide failed: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      }
    } catch (error) {
      console.error('Error fetching tides:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Tide exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to fetch tides: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchSurf = async () => {
    setIsLoading(true);
    addLog('Fetching surf report data for Folly Beach, SC...');

    try {
      const response = await supabase.functions.invoke('fetch-surf-reports');
      
      console.log('Surf response:', response);
      addLog(`Surf response: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Surf error: ${errorMsg}`, 'error');
        Alert.alert('Error', `Edge Function returned a non-2xx status code: ${errorMsg}`);
      } else if (response.data?.success) {
        addLog(`✅ Surf fetch successful: Found ${response.data.data?.wave_height || 'N/A'}`, 'success');
        Alert.alert('Success', response.data.message || 'Surf data fetched successfully');
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch surf data';
        const details = response.data?.details ? `\n\nDetails: ${response.data.details}` : '';
        addLog(`❌ Surf failed: ${errorMsg}${details}`, 'error');
        Alert.alert('Error', `Edge Function returned a non-2xx status code\n\n${errorMsg}${details}`);
      }
    } catch (error) {
      console.error('Error fetching surf:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Surf exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Edge Function returned a non-2xx status code: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLog = () => {
    setActivityLog([]);
    addLog('Activity log cleared');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Data Sources',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Data Counts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Data (Today)</Text>
          <View style={styles.countsGrid}>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{dataCounts.tides}</Text>
              <Text style={styles.countLabel}>Tides</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{dataCounts.weather}</Text>
              <Text style={styles.countLabel}>Weather</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{dataCounts.forecast}</Text>
              <Text style={styles.countLabel}>Forecast</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{dataCounts.surf}</Text>
              <Text style={styles.countLabel}>Surf</Text>
            </View>
          </View>
        </View>

        {/* Update All Button */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleUpdateAll}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🔄 Update All Data</Text>
          )}
        </TouchableOpacity>

        {/* Individual Updates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Individual Updates</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchWeather}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🌤️ Fetch Weather & Forecast</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchTides}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🌊 Fetch Tide Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchSurf}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🏄 Fetch Surf Report</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Log */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            <TouchableOpacity onPress={handleClearLog}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContainer}>
            {activityLog.length === 0 ? (
              <Text style={styles.logEmpty}>No activity yet</Text>
            ) : (
              activityLog.map((log, index) => (
                <View key={index} style={styles.logEntry}>
                  <Text style={styles.logTimestamp}>[{log.timestamp}]</Text>
                  <Text style={[
                    styles.logMessage,
                    log.type === 'error' && styles.logError,
                    log.type === 'success' && styles.logSuccess,
                  ]}>
                    {log.message}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  countsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  countCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  countValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  countLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    maxHeight: 400,
  },
  logEmpty: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  logEntry: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  logTimestamp: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: 8,
    fontFamily: 'monospace',
  },
  logMessage: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
    fontFamily: 'monospace',
  },
  logError: {
    color: '#ff4444',
  },
  logSuccess: {
    color: '#44ff44',
  },
});
