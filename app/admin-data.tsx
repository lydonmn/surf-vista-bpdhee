
import { useState, useEffect, useCallback } from 'react';
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
import { useLocation } from '@/contexts/LocationContext';

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
  type: 'info' | 'success' | 'error' | 'warning';
}

interface LocationReport {
  location: string;
  locationId: string;
  date: string;
  hasReport: boolean;
  hasNarrative: boolean;
  narrativeLength: number;
  waveHeight: string;
  waveSensorsOnline: boolean;
  lastUpdated: string;
  buoyId: string;
}

export default function AdminDataScreen() {
  const router = useRouter();
  const { currentLocation, locationData, locations } = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[AdminDataScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setActivityLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 50));
  }, []);

  const loadLocationReports = useCallback(async (today: string) => {
    try {
      const reports: LocationReport[] = [];

      for (const loc of locations) {
        const { data: locConfig } = await supabase
          .from('locations')
          .select('buoy_id')
          .eq('id', loc.id)
          .single();

        const { data: report } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('date', today)
          .eq('location', loc.id)
          .maybeSingle();

        const waveSensorsOnline = report?.wave_height && report.wave_height !== 'N/A' && report.wave_height !== '';

        reports.push({
          location: loc.displayName,
          locationId: loc.id,
          date: today,
          hasReport: !!report,
          hasNarrative: !!(report?.conditions && report.conditions.length > 100),
          narrativeLength: report?.conditions?.length || 0,
          waveHeight: report?.wave_height || 'N/A',
          waveSensorsOnline: waveSensorsOnline,
          lastUpdated: report?.updated_at || 'Never',
          buoyId: locConfig?.buoy_id || 'Unknown',
        });
      }

      setLocationReports(reports);
    } catch (error) {
      console.error('Error loading location reports:', error);
    }
  }, [locations]);

  const loadDataCounts = useCallback(async () => {
    try {
      addLog(`Loading data counts for ${locationData.displayName}...`);
      
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
        supabase.from('tide_data').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
        supabase.from('weather_data').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
        supabase.from('weather_forecast').select('id', { count: 'exact', head: true }).eq('location', currentLocation),
        supabase.from('surf_conditions').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
        supabase.from('external_surf_reports').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
      ]);

      setDataCounts({
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
        external: externalResult.count || 0,
      });

      addLog(`Data counts loaded for ${locationData.displayName}: Tides=${tidesResult.count}, Weather=${weatherResult.count}, Forecast=${forecastResult.count}, Surf=${surfResult.count}, External=${externalResult.count}`, 'success');
      
      await loadLocationReports(today);
    } catch (error) {
      console.error('Error loading data counts:', error);
      addLog(`Error loading data counts: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [addLog, currentLocation, locationData, loadLocationReports]);

  useEffect(() => {
    console.log('[AdminDataScreen] Component mounted, loading data counts');
    loadDataCounts();
  }, [loadDataCounts]);

  const handlePullAndGenerateAllLocations = async () => {
    setIsLoading(true);
    addLog(`🔄 Pulling new data and generating reports for ALL locations...`);
    addLog(`⏳ This may take 2-3 minutes due to NOAA server response times...`, 'warning');
    addLog(`📍 Processing: ${locations.map(l => l.displayName).join(', ')}`, 'info');

    try {
      // Step 1: Pull fresh data for all locations
      addLog(`Step 1/2: Pulling fresh NOAA data for all locations...`, 'info');
      
      const dataResults = [];
      for (const loc of locations) {
        addLog(`  📍 Fetching data for ${loc.displayName}...`, 'info');
        
        try {
          const response = await supabase.functions.invoke('update-all-surf-data', {
            body: { location: loc.id }
          });
          
          if (response.error) {
            addLog(`  ❌ ${loc.displayName}: ${response.error.message}`, 'error');
            dataResults.push({ location: loc.displayName, success: false, error: response.error.message });
          } else if (response.data?.success) {
            addLog(`  ✅ ${loc.displayName}: Data pulled successfully`, 'success');
            dataResults.push({ location: loc.displayName, success: true });
          } else {
            const errorMsg = response.data?.error || 'Unknown error';
            addLog(`  ⚠️ ${loc.displayName}: ${errorMsg}`, 'warning');
            dataResults.push({ location: loc.displayName, success: false, error: errorMsg });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          addLog(`  ❌ ${loc.displayName}: ${errorMsg}`, 'error');
          dataResults.push({ location: loc.displayName, success: false, error: errorMsg });
        }
        
        // Small delay between locations to avoid overwhelming NOAA servers
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 2: Generate reports for all locations
      addLog(`Step 2/2: Generating narrative reports for all locations...`, 'info');
      
      const response = await supabase.functions.invoke('daily-5am-report-with-retry', {
        body: {}
      });
      
      console.log('Generate reports response:', response);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Report generation error: ${errorMsg}`, 'error');
        
        // Show partial success if data was pulled
        const dataSuccessCount = dataResults.filter(r => r.success).length;
        if (dataSuccessCount > 0) {
          Alert.alert(
            'Partial Success',
            `Data pulled for ${dataSuccessCount}/${locations.length} locations, but report generation failed.\n\nError: ${errorMsg}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', errorMsg);
        }
      } else if (response.data?.success) {
        const results = response.data.results || [];
        const successCount = results.filter((r: any) => r.success).length;
        const totalCount = results.length;
        
        addLog(`✅ Complete! Data pulled and reports generated: ${successCount}/${totalCount} locations`, 'success');
        
        // Log each location result
        results.forEach((result: any) => {
          if (result.success) {
            if (result.skipped) {
              addLog(`  ✅ ${result.location}: Report already exists`, 'info');
            } else {
              const waveStatus = result.hasWaveData ? '🌊 Wave sensors online' : '⚠️ Wave sensors offline';
              addLog(`  ✅ ${result.location}: Report generated (${waveStatus})`, 'success');
            }
          } else {
            addLog(`  ❌ ${result.location}: ${result.error}`, 'error');
          }
        });
        
        const resultDetails = results.map((r: any) => {
          if (r.success) {
            const waveIcon = r.hasWaveData ? '🌊' : '⚠️';
            return `${r.location}: ✅ ${waveIcon}`;
          }
          return `${r.location}: ❌`;
        }).join('\n');
        
        Alert.alert(
          'Success!',
          `Data pulled and reports generated for all locations!\n\nResults: ${successCount}/${totalCount}\n\n${resultDetails}\n\n⚠️ = Wave sensors offline (wind/temp data only)`,
          [{ text: 'OK' }]
        );
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Report generation failed';
        addLog(`❌ Report generation failed: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      }
    } catch (error) {
      console.error('Error in pull and generate:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to complete operation: ${errorMsg}`);
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
      router.replace('/(tabs)/(home)');
    }
  };

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'arrow-back';
  const backButtonTextContent = 'Back';
  const headerTitleText = 'Admin Data Manager';
  const locationCountText = locations.length === 1 ? '1 Location' : `${locations.length} Locations`;
  const mainButtonText = `🔄 Pull Data & Generate Reports (${locationCountText})`;
  const sectionTitleText1 = `Current Data (Today) - ${locationData.displayName}`;
  const countLabelTides = 'Tides';
  const countLabelWeather = 'Weather';
  const countLabelForecast = 'Forecast';
  const countLabelSurf = 'Surf';
  const infoTitleText = '⏰ Automated Update Schedule';
  const locationListText = locations.map(loc => `  - ${loc.displayName}`).join('\n');
  const infoTextContent = `✅ ACTIVE - Automated updates are running!

• 5:00 AM EST: Generate initial conditions narrative for ALL locations
${locationListText}
• Every 15 min (5 AM - 9 PM): Update buoy data only (narrative preserved)
• Failed fetches preserve existing data

The system automatically generates separate reports for each location every morning at 5 AM EST. The initial narrative is retained all day while buoy data updates every 15 minutes.`;
  const sectionTitleText2 = 'Activity Log';
  const clearButtonText = 'Clear';
  const logEmptyText = 'No activity yet';
  const locationStatusTitle = '📍 Today\'s Report Status (All Locations)';

  return (
    <View style={styles.container}>
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
        {/* Location Selector */}
        <View style={styles.locationSelectorCard}>
          <Text style={styles.locationSelectorTitle}>📍 Select Location</Text>
          <View style={styles.locationButtons}>
            {locations.map((loc) => {
              const isActive = currentLocation === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.locationButton,
                    isActive && styles.locationButtonActive
                  ]}
                  onPress={() => {
                    console.log('[AdminDataScreen] Switching to', loc.name);
                    router.setParams({ location: loc.id });
                  }}
                >
                  <Text style={[
                    styles.locationButtonText,
                    isActive && styles.locationButtonTextActive
                  ]}>
                    {loc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.locationSelectorSubtitle}>
            Currently viewing: {locationData.displayName}
          </Text>
        </View>

        {/* Main Action Button - Pull Data & Generate Reports for All Locations */}
        <View style={styles.mainActionCard}>
          <Text style={styles.mainActionTitle}>🚀 Primary Action</Text>
          <Text style={styles.mainActionDescription}>
            This will pull fresh NOAA data (weather, tides, buoy) for all locations, then generate narrative reports for each location. This is the same process that runs automatically at 5 AM EST every day.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handlePullAndGenerateAllLocations}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.clockwise.circle.fill"
                  android_material_icon_name="sync"
                  size={24}
                  color="#fff"
                />
                <Text style={styles.buttonText}>{mainButtonText}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Data Counts for Current Location */}
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

        {/* Location Report Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{locationStatusTitle}</Text>
          {locationReports.map((report) => {
            const statusIcon = report.hasReport && report.hasNarrative ? '✅' : report.hasReport ? '⚠️' : '❌';
            const statusText = report.hasReport && report.hasNarrative 
              ? 'Report with narrative' 
              : report.hasReport 
                ? 'Report without narrative' 
                : 'No report';
            const lastUpdatedText = report.lastUpdated !== 'Never' 
              ? new Date(report.lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : 'Never';
            const sensorStatus = report.waveSensorsOnline ? '🌊 Wave sensors online' : '⚠️ Wave sensors offline';
            
            return (
              <View style={styles.locationCard} key={report.locationId}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationName}>{report.location}</Text>
                  <Text style={styles.locationStatus}>{statusIcon}</Text>
                </View>
                <View style={styles.locationDetails}>
                  <Text style={styles.locationDetailText}>Status: {statusText}</Text>
                  <Text style={styles.locationDetailText}>Buoy: {report.buoyId}</Text>
                  <Text style={[
                    styles.locationDetailText,
                    !report.waveSensorsOnline && styles.locationDetailWarning
                  ]}>
                    {sensorStatus}
                  </Text>
                  <Text style={styles.locationDetailText}>Wave Height: {report.waveHeight}</Text>
                  <Text style={styles.locationDetailText}>Narrative: {report.narrativeLength} chars</Text>
                  <Text style={styles.locationDetailText}>Last Updated: {lastUpdatedText}</Text>
                </View>
                {!report.waveSensorsOnline && (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                      ⚠️ NOAA buoy {report.buoyId} wave sensors are currently offline. This is a hardware issue with the buoy, not the app. Reports will show wind/water temp data only until sensors come back online.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Automated Update Schedule Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{infoTitleText}</Text>
          <Text style={styles.infoText}>
            {infoTextContent}
          </Text>
        </View>

        {/* Activity Log */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>{sectionTitleText2}</Text>
            <TouchableOpacity onPress={handleClearLog}>
              <Text style={styles.clearButton}>{clearButtonText}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContainer}>
            {activityLog.length === 0 ? (
              <Text style={styles.logEmpty}>{logEmptyText}</Text>
            ) : (
              <>
                {activityLog.map((log) => {
                  const logTimestampText = `[${log.timestamp}]`;
                  return (
                    <View key={log.id} style={styles.logEntry}>
                      <Text style={styles.logTimestamp}>{logTimestampText}</Text>
                      <Text style={[
                        styles.logMessage,
                        log.type === 'error' && styles.logError,
                        log.type === 'success' && styles.logSuccess,
                        log.type === 'warning' && styles.logWarning,
                      ]}>
                        {log.message}
                      </Text>
                    </View>
                  );
                })}
              </>
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
  mainActionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  mainActionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  mainActionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  logWarning: {
    color: '#ffaa00',
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
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  locationStatus: {
    fontSize: 24,
  },
  locationDetails: {
    gap: 4,
  },
  locationDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationDetailWarning: {
    color: '#ffaa00',
    fontWeight: '600',
  },
  warningBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffaa00',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  locationSelectorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  locationSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  locationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  locationButton: {
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  locationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  locationButtonTextActive: {
    color: '#FFFFFF',
  },
  locationSelectorSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
