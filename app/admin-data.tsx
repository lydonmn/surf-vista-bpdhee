
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface DataCounts {
  tides: number;
  weather: number;
  forecast: number;
  surf: number;
  external: number;
}

interface ActivityLog {
  id: string;
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
    console.log(`[AdminDataScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setActivityLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 50));
  };

  const loadDataCounts = useCallback(async () => {
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
  }, [addLog]);

  useEffect(() => {
    console.log('[AdminDataScreen] Component mounted, loading data counts');
    loadDataCounts();
  }, [loadDataCounts]);

  const handleTriggerDailyUpdate = async () => {
    setIsLoading(true);
    addLog('Manually triggering daily update (same as 5 AM automatic update)...');

    try {
      const response = await supabase.functions.invoke('daily-update-cron');
      
      console.log('Daily update response:', response);
      addLog(`Daily update response: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Daily update error: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      } else if (response.data?.success) {
        addLog('✅ Daily update completed successfully!', 'success');
        Alert.alert('Success', 'Daily update completed! Data refreshed and new report generated.');
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Daily update failed';
        addLog(`❌ Daily update failed: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      }
    } catch (error) {
      console.error('Error triggering daily update:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Daily update exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to trigger daily update: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAll = async () => {
    setIsLoading(true);
    addLog('Starting periodic data update (no report generation)...');

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

  const handleGenerateReport = async () => {
    setIsLoading(true);
    addLog('Generating new surf report...');

    try {
      const response = await supabase.functions.invoke('generate-daily-report');
      
      console.log('Generate report response:', response);
      addLog(`Generate report response: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Report generation error: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      } else if (response.data?.success) {
        addLog(`✅ Report generated successfully`, 'success');
        
        // Show data age warning if applicable
        if (response.data.dataAge && response.data.dataAge !== 'Using current data') {
          addLog(`⚠️ ${response.data.dataAge}`, 'info');
          Alert.alert('Success', `${response.data.message}\n\n${response.data.dataAge}`);
        } else {
          Alert.alert('Success', response.data.message || 'Surf report generated successfully');
        }
        
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to generate report';
        const suggestion = response.data?.suggestion || '';
        const missingData = response.data?.missingData || [];
        
        let fullMessage = errorMsg;
        if (missingData.length > 0) {
          fullMessage += `\n\nMissing: ${missingData.join(', ')}`;
        }
        if (suggestion) {
          fullMessage += `\n\n${suggestion}`;
        }
        
        addLog(`❌ Report generation failed: ${errorMsg}`, 'error');
        Alert.alert('Cannot Generate Report', fullMessage);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Report generation exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to generate report: ${errorMsg}`);
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
    console.log('[AdminDataScreen] Clearing activity log');
    setActivityLog([]);
    addLog('Activity log cleared');
  };

  const handleGoBack = () => {
    console.log('[AdminDataScreen] Navigating back...');
    if (router.canGoBack()) {
      router.back();
    } else {
      // If can't go back, navigate to home
      router.replace('/(tabs)/(home)');
    }
  };

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'arrow_back';
  const backButtonTextContent = 'Back';
  const headerTitleText = 'Data Sources';
  const sectionTitleText1 = 'Current Data (Today)';
  const countLabelTides = 'Tides';
  const countLabelWeather = 'Weather';
  const countLabelForecast = 'Forecast';
  const countLabelSurf = 'Surf';
  const infoTitleText = '⏰ Automated Update Schedule';
  const infoTextContent = `✅ ACTIVE - Automated updates are running!

• 5:00 AM EST: Full data update + report generation
• Every 15 min (5 AM - 9 PM): Data updates only
• Failed fetches preserve existing data

The system will automatically generate a new surf report every morning at 5 AM EST and update data throughout the day.`;
  const buttonText1 = '🌅 Trigger Daily Update (5 AM Simulation)';
  const buttonText2 = '🔄 Update Data Only (No Report)';
  const buttonText3 = '📝 Generate New Surf Report';
  const sectionTitleText2 = 'Individual Updates';
  const buttonText4 = '🌤️ Fetch Weather & Forecast';
  const buttonText5 = '🌊 Fetch Tide Data';
  const buttonText6 = '🏄 Fetch Surf Report';
  const sectionTitleText3 = 'Activity Log';
  const clearButtonText = 'Clear';
  const logEmptyText = 'No activity yet';

  return (
    <View style={styles.container}>
      {/* Custom Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <IconSymbol
            ios_icon_name={backIconName}
            android_material_icon_name={backMaterialIconName}
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            {backButtonTextContent}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Data Counts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText1}</Text>
          <View style={styles.countsGrid}>
            <View style={styles.countCard} key="tides-count">
              <Text style={styles.countValue}>{dataCounts.tides}</Text>
              <Text style={styles.countLabel}>{countLabelTides}</Text>
            </View>
            <View style={styles.countCard} key="weather-count">
              <Text style={styles.countValue}>{dataCounts.weather}</Text>
              <Text style={styles.countLabel}>{countLabelWeather}</Text>
            </View>
            <View style={styles.countCard} key="forecast-count">
              <Text style={styles.countValue}>{dataCounts.forecast}</Text>
              <Text style={styles.countLabel}>{countLabelForecast}</Text>
            </View>
            <View style={styles.countCard} key="surf-count">
              <Text style={styles.countValue}>{dataCounts.surf}</Text>
              <Text style={styles.countLabel}>{countLabelSurf}</Text>
            </View>
          </View>
        </View>

        {/* Automated Update Schedule Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{infoTitleText}</Text>
          <Text style={styles.infoText}>
            {infoTextContent}
          </Text>
        </View>

        {/* Manual Daily Update Button (simulates 5 AM automatic update) */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleTriggerDailyUpdate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{buttonText1}</Text>
          )}
        </TouchableOpacity>

        {/* Update Data Only Button */}
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleUpdateAll}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{buttonText2}</Text>
          )}
        </TouchableOpacity>

        {/* Generate Report Button */}
        <TouchableOpacity
          style={[styles.button, styles.accentButton, isLoading && styles.buttonDisabled]}
          onPress={handleGenerateReport}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{buttonText3}</Text>
          )}
        </TouchableOpacity>

        {/* Individual Updates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText2}</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchWeather}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{buttonText4}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchTides}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{buttonText5}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchSurf}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{buttonText6}</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Log */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>{sectionTitleText3}</Text>
            <TouchableOpacity onPress={handleClearLog}>
              <Text style={styles.clearButton}>{clearButtonText}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContainer}>
            {activityLog.length === 0 ? (
              <Text style={styles.logEmpty}>{logEmptyText}</Text>
            ) : (
              <React.Fragment>
                {activityLog.map((log) => {
                  const logTimestampText = `[${log.timestamp}]`;
                  return (
                    <View key={log.id} style={styles.logEntry}>
                      <Text style={styles.logTimestamp}>{logTimestampText}</Text>
                      <Text style={[
                        styles.logMessage,
                        log.type === 'error' && styles.logError,
                        log.type === 'success' && styles.logSuccess,
                      ]}>
                        {log.message}
                      </Text>
                    </View>
                  );
                })}
              </React.Fragment>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
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
  accentButton: {
    backgroundColor: colors.accent,
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
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
