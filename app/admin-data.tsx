
import React, { useState, useEffect, useCallback } from 'react';
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
  const [tideCount, setTideCount] = useState<number>(0);
  const [weatherCount, setWeatherCount] = useState<number>(0);
  const [forecastCount, setForecastCount] = useState<number>(0);
  const [surfReportCount, setSurfReportCount] = useState<number>(0);
  const [externalSurfCount, setExternalSurfCount] = useState<number>(0);
  const [testTideData, setTestTideData] = useState<any[]>([]);
  const [testSurfData, setTestSurfData] = useState<any>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  }, []);

  const loadDataCounts = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [tideResult, weatherResult, forecastResult, surfResult, externalSurfResult] = await Promise.all([
        supabase.from('tide_data').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('weather_data').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('weather_forecast').select('*', { count: 'exact', head: true }).gte('date', today),
        supabase.from('surf_reports').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('external_surf_reports').select('*', { count: 'exact', head: true }).eq('date', today),
      ]);

      setTideCount(tideResult.count || 0);
      setWeatherCount(weatherResult.count || 0);
      setForecastCount(forecastResult.count || 0);
      setSurfReportCount(surfResult.count || 0);
      setExternalSurfCount(externalSurfResult.count || 0);
      
      addLog(`Data counts loaded: Tides=${tideResult.count}, Weather=${weatherResult.count}, Forecast=${forecastResult.count}, Surf=${surfResult.count}, External=${externalSurfResult.count}`);
    } catch (error) {
      console.error('Error loading data counts:', error);
      addLog(`Error loading counts: ${error}`);
    }
  }, [addLog]);

  const testTideDataFetch = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      addLog(`Testing tide data fetch for ${today}...`);
      
      const { data, error } = await supabase
        .from('tide_data')
        .select('*')
        .eq('date', today)
        .order('time');
      
      if (error) {
        addLog(`❌ Tide fetch error: ${error.message}`);
        console.error('Tide fetch error:', error);
      } else {
        addLog(`✅ Tide fetch successful: ${data?.length || 0} records`);
        console.log('Tide data:', data);
        setTestTideData(data || []);
      }
    } catch (error) {
      addLog(`❌ Exception: ${error}`);
      console.error('Exception:', error);
    }
  }, [addLog]);

  const testSurfDataFetch = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      addLog(`Testing surf data fetch for ${today}...`);
      
      const { data, error } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .maybeSingle();
      
      if (error) {
        addLog(`❌ Surf fetch error: ${error.message}`);
        console.error('Surf fetch error:', error);
      } else {
        addLog(`✅ Surf fetch successful: ${data ? 'Found' : 'Not found'}`);
        console.log('Surf data:', data);
        setTestSurfData(data);
      }
    } catch (error) {
      addLog(`❌ Exception: ${error}`);
      console.error('Exception:', error);
    }
  }, [addLog]);

  useEffect(() => {
    loadDataCounts();
    testTideDataFetch();
    testSurfDataFetch();
  }, [loadDataCounts, testTideDataFetch, testSurfDataFetch]);

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
        await loadDataCounts();
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
        await loadDataCounts();
        await testTideDataFetch();
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
        await loadDataCounts();
        await testSurfDataFetch();
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
        await loadDataCounts();
        await testSurfDataFetch();
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
      await loadDataCounts();
      await testTideDataFetch();
      await testSurfDataFetch();
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

        {/* Data Status Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Current Data Status
          </Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Tide Records (Today):
            </Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>
              {tideCount}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Weather Data (Today):
            </Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>
              {weatherCount}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Forecast Records:
            </Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>
              {forecastCount}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Surf Reports (Today):
            </Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>
              {surfReportCount}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              External Surf Data:
            </Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>
              {externalSurfCount}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              loadDataCounts();
              testTideDataFetch();
              testSurfDataFetch();
            }}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.refreshButtonText}>Refresh Counts</Text>
          </TouchableOpacity>
        </View>

        {/* Surf Data Test Card */}
        {testSurfData && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Surf Report Data (Today)
              </Text>
              <TouchableOpacity
                style={[styles.editReportButton, { backgroundColor: colors.accent }]}
                onPress={() => router.push(`/edit-report?id=${testSurfData.id}`)}
              >
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.editReportButtonText}>Edit Report</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.surfDataRow}>
              <Text style={[styles.surfDataLabel, { color: colors.textSecondary }]}>
                Wave Height:
              </Text>
              <Text style={[styles.surfDataValue, { color: theme.colors.text }]}>
                {testSurfData.wave_height || 'N/A'}
              </Text>
            </View>
            <View style={styles.surfDataRow}>
              <Text style={[styles.surfDataLabel, { color: colors.textSecondary }]}>
                Wave Period:
              </Text>
              <Text style={[styles.surfDataValue, { color: theme.colors.text }]}>
                {testSurfData.wave_period || 'N/A'}
              </Text>
            </View>
            <View style={styles.surfDataRow}>
              <Text style={[styles.surfDataLabel, { color: colors.textSecondary }]}>
                Water Temp:
              </Text>
              <Text style={[styles.surfDataValue, { color: theme.colors.text }]}>
                {testSurfData.water_temp || 'N/A'}
              </Text>
            </View>
            <View style={styles.surfDataRow}>
              <Text style={[styles.surfDataLabel, { color: colors.textSecondary }]}>
                Rating:
              </Text>
              <Text style={[styles.surfDataValue, { color: theme.colors.text }]}>
                {testSurfData.rating || 'N/A'}/10
              </Text>
            </View>
            {testSurfData.report_text && (
              <View style={[styles.customTextBadge, { backgroundColor: colors.primary }]}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check_circle"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.customTextBadgeText}>Custom text active</Text>
              </View>
            )}
          </View>
        )}

        {/* Tide Data Test Card */}
        {testTideData.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Tide Data Test (Today)
            </Text>
            {testTideData.map((tide, index) => (
              <View key={index} style={styles.tideTestRow}>
                <Text style={[styles.tideTestText, { color: theme.colors.text }]}>
                  {tide.time} - {tide.type.toUpperCase()} - {Number(tide.height).toFixed(1)} ft
                </Text>
              </View>
            ))}
          </View>
        )}

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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  editReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editReportButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  customTextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  customTextBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  surfDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  surfDataLabel: {
    fontSize: 14,
  },
  surfDataValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tideTestRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tideTestText: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 12,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
