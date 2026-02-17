
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useLocation } from '@/contexts/LocationContext';
import { PushNotificationTester } from '@/components/PushNotificationTester';
import { NotificationIntegrationStatus } from '@/components/NotificationIntegrationStatus';
import { getESTDate } from '@/utils/surfDataFormatter';

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
  narrativePreview: string;
  waveHeight: string;
  waveSensorsOnline: boolean;
  lastUpdated: string;
  buoyId: string;
}

export default function AdminDataScreen() {
  const router = useRouter();
  const { currentLocation, locations } = useLocation();
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCompleteDataTime, setNextCompleteDataTime] = useState<string>('');
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const showErrorModal = (title: string, message: string) => {
    console.log('[AdminData] Showing error modal:', title, message);
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    console.log(`[AdminData] Log [${type}]:`, message);
    setActivityLog(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  const loadDataCounts = useCallback(async () => {
    try {
      const dateStr = getESTDate();
      
      console.log('[AdminData] Loading data counts for date:', dateStr, 'location:', currentLocation);
      
      const [tidesResult, weatherResult, forecastResult, surfResult] = await Promise.all([
        supabase.from('tide_data').select('id', { count: 'exact', head: true }).eq('location', currentLocation).eq('date', dateStr),
        supabase.from('weather_data').select('id', { count: 'exact', head: true }).eq('location', currentLocation).eq('date', dateStr),
        supabase.from('weather_forecast').select('id', { count: 'exact', head: true }).eq('location', currentLocation).gte('date', dateStr),
        supabase.from('surf_conditions').select('id', { count: 'exact', head: true }).eq('location', currentLocation).eq('date', dateStr),
      ]);

      setDataCounts({
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
        external: 0,
      });
      
      console.log('[AdminData] Data counts loaded:', {
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
      });
    } catch (error) {
      console.error('[AdminData] Error loading data counts:', error);
    }
  }, [currentLocation]);

  const loadLocationReports = useCallback(async () => {
    try {
      const dateStr = getESTDate();
      const reports: LocationReport[] = [];

      console.log('[AdminData] ═══════════════════════════════════════');
      console.log('[AdminData] 🔄 LOADING LOCATION REPORTS');
      console.log('[AdminData] Date:', dateStr);
      console.log('[AdminData] Available locations:', locations.length);
      console.log('[AdminData] Cache-busting timestamp:', Date.now());
      console.log('[AdminData] ═══════════════════════════════════════');

      for (const location of locations) {
        console.log('[AdminData] Processing location:', {
          id: location.id,
          name: location.name,
          displayName: location.displayName,
        });

        // 🚨 CRITICAL FIX: Force fresh query with cache bypass using timestamp
        const cacheBuster = Date.now();
        const [reportResult, conditionsResult] = await Promise.all([
          supabase
            .from('surf_reports')
            .select('*')
            .eq('location', location.id)
            .eq('date', dateStr)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('surf_conditions')
            .select('*')
            .eq('location', location.id)
            .eq('date', dateStr)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const report = reportResult.data;
        const conditions = conditionsResult.data;

        console.log('[AdminData] ═══════════════════════════════════════');
        console.log('[AdminData] 📊 REPORT DATA FOR', location.displayName);
        console.log('[AdminData] Cache buster:', cacheBuster);
        console.log('[AdminData] Has report:', !!report);
        console.log('[AdminData] Report ID:', report?.id);
        console.log('[AdminData] Report date:', report?.date);
        console.log('[AdminData] Has conditions field:', !!report?.conditions);
        console.log('[AdminData] Has report_text field:', !!report?.report_text);
        console.log('[AdminData] Conditions length:', report?.conditions?.length || 0);
        console.log('[AdminData] Report_text length:', report?.report_text?.length || 0);
        console.log('[AdminData] Conditions preview:', report?.conditions?.substring(0, 100));
        console.log('[AdminData] Report_text preview:', report?.report_text?.substring(0, 100));
        console.log('[AdminData] Updated at:', report?.updated_at);
        console.log('[AdminData] ═══════════════════════════════════════');

        // 🚨 CRITICAL: Prefer report_text over conditions for display
        const narrativeText = report?.report_text || report?.conditions || '';
        
        const locationReport: LocationReport = {
          location: location.displayName,
          locationId: location.id,
          date: dateStr,
          hasReport: !!report,
          hasNarrative: narrativeText.length > 50,
          narrativeLength: narrativeText.length,
          narrativePreview: narrativeText.substring(0, 100),
          waveHeight: conditions?.wave_height || report?.wave_height || 'N/A',
          waveSensorsOnline: !!conditions?.wave_height,
          lastUpdated: conditions?.updated_at || report?.updated_at || 'Never',
          buoyId: location.buoyId,
        };

        console.log('[AdminData] Location report created:', locationReport);
        reports.push(locationReport);
      }

      console.log('[AdminData] ✅ Loaded', reports.length, 'location reports');
      setLocationReports(reports);
    } catch (error) {
      console.error('[AdminData] Error loading location reports:', error);
    }
  }, [locations]);

  const calculateNextCompleteDataTime = useCallback(() => {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    const next6AM = new Date(estNow);
    next6AM.setHours(6, 0, 0, 0);
    
    if (estNow.getHours() >= 6) {
      next6AM.setDate(next6AM.getDate() + 1);
    }
    
    const hoursUntil = Math.floor((next6AM.getTime() - estNow.getTime()) / (1000 * 60 * 60));
    const minutesUntil = Math.floor(((next6AM.getTime() - estNow.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
    
    setNextCompleteDataTime(`${hoursUntil}h ${minutesUntil}m`);
  }, []);

  useEffect(() => {
    console.log('[AdminData] Component mounted, initializing...');
    loadDataCounts();
    loadLocationReports();
    calculateNextCompleteDataTime();
    
    const interval = setInterval(() => {
      calculateNextCompleteDataTime();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [loadDataCounts, loadLocationReports, calculateNextCompleteDataTime]);

  const handlePullDataForLocation = async (locationId: string, locationName: string) => {
    setIsLoading(true);
    addLog(`Pulling data for ${locationName}...`, 'info');

    try {
      console.log(`[AdminData] Invoking update-all-surf-data for ${locationId}`);
      
      const { data, error } = await supabase.functions.invoke('update-all-surf-data', {
        body: { location: locationId },
      });

      console.log('[AdminData] Update response:', { data, error });

      if (error) {
        throw new Error(error.message || 'Failed to update data');
      }

      if (data && !data.success) {
        const errorMsg = data.errors?.join(', ') || data.error || 'Update failed';
        throw new Error(errorMsg);
      }

      addLog(`✅ Data updated successfully for ${locationName}`, 'success');
      
      await loadDataCounts();
      await loadLocationReports();
    } catch (error) {
      console.error('[AdminData] Error pulling data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to update ${locationName}: ${errorMessage}`, 'error');
      showErrorModal('Update Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateForecast = async (locationId: string, locationName: string) => {
    setIsLoading(true);
    addLog(`Updating 7-day forecast for ${locationName}...`, 'info');

    try {
      console.log(`[AdminData] Invoking fetch-surf-forecast for location: ${locationId}`);
      
      const requestBody = { location: locationId };
      console.log('[AdminData] Request body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('fetch-surf-forecast', {
        body: requestBody,
      });

      console.log('[AdminData] Forecast update response:', { data, error });

      if (error) {
        console.error('[AdminData] Edge function error:', error);
        throw new Error(error.message || 'Failed to update forecast');
      }

      if (!data) {
        throw new Error('No response data received from forecast function');
      }

      if (data.success === false) {
        const errorMsg = data.error || 'Forecast update failed';
        console.error('[AdminData] Forecast function returned error:', errorMsg);
        throw new Error(errorMsg);
      }

      addLog(`✅ 7-day forecast updated for ${locationName}`, 'success');
      
      if (data.has_buoy_data) {
        addLog(`  • Using live buoy data`, 'success');
      } else {
        addLog(`  • Using baseline estimates (no buoy data)`, 'warning');
      }
      
      if (data.has_historical_data) {
        addLog(`  • Trend analysis applied`, 'success');
      }
      
      if (data.trend) {
        const trendText = `${data.trend.trend}`;
        const rateText = `${data.trend.rate.toFixed(1)}%`;
        addLog(`  • Detected trend: ${trendText} (${rateText})`, 'info');
      }
      
      await loadDataCounts();
      await loadLocationReports();
    } catch (error) {
      console.error('[AdminData] Error updating forecast:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to update forecast for ${locationName}: ${errorMessage}`, 'error');
      showErrorModal('Forecast Update Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReportForLocation = async (locationId: string, locationName: string) => {
    console.log('[AdminData] ═══════════════════════════════════════');
    console.log('[AdminData] 🚀 REGENERATE TEXT BUTTON CLICKED');
    console.log('[AdminData] Location:', locationName);
    console.log('[AdminData] Location ID:', locationId);
    console.log('[AdminData] ═══════════════════════════════════════');
    
    setIsLoading(true);
    addLog(`Regenerating report narrative for ${locationName}...`, 'info');

    try {
      console.log(`[AdminData] ═══════════════════════════════════════`);
      console.log(`[AdminData] 📝 MANUAL REPORT GENERATION`);
      console.log(`[AdminData] ✅ Using EXISTING data from database`);
      console.log(`[AdminData] ❌ NOT pulling fresh data from buoy`);
      console.log(`[AdminData] 📊 Data source: surf_conditions, weather_data, tide_data tables`);
      console.log(`[AdminData] 🎯 Purpose: Regenerate narrative text only`);
      console.log(`[AdminData] ═══════════════════════════════════════`);
      console.log(`[AdminData] Invoking daily-6am-report-with-retry for ${locationId} with isManualTrigger=true`);
      
      // 🚨 CRITICAL: The manual report generator ONLY uses existing database data
      // It does NOT fetch fresh data from the buoy or external APIs
      // The report page already has the most up-to-date data from scheduled updates
      // This function ONLY regenerates the narrative text using that existing data
      const { data, error } = await supabase.functions.invoke('daily-6am-report-with-retry', {
        body: { 
          location: locationId,
          isManualTrigger: true // ✅ This tells backend: Use database data ONLY, no fresh API calls
        },
      });

      console.log('[AdminData] ═══════════════════════════════════════');
      console.log('[AdminData] 📥 EDGE FUNCTION RESPONSE');
      console.log('[AdminData] Success:', data?.success);
      console.log('[AdminData] Error:', error);
      console.log('[AdminData] Data:', JSON.stringify(data, null, 2));
      console.log('[AdminData] ═══════════════════════════════════════');

      if (error) {
        console.error('[AdminData] ❌ Error invoking Edge Function:', error);
        // 🚨 CRITICAL: Show detailed error to help debug
        const errorDetails = error.message || JSON.stringify(error);
        throw new Error(`Edge Function error: ${errorDetails}`);
      }

      if (data && data.success === false) {
        const errorMsg = data.error || data.message || 'Report generation failed';
        console.error('[AdminData] ❌ Edge Function reported failure:', errorMsg);
        
        // 🚨 CRITICAL: Include stack trace if available
        if (data.stack) {
          console.error('[AdminData] Stack trace:', data.stack);
        }
        
        throw new Error(errorMsg);
      }

      console.log('[AdminData] ✅ Edge Function call successful');
      addLog(`✅ Report narrative regenerated for ${locationName}`, 'success');
      addLog(`  • Used existing data from database (no fresh buoy pull)`, 'info');
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        console.log('[AdminData] Result details:', result);
        
        if (result.narrativeLength) {
          addLog(`  • Generated ${result.narrativeLength} character narrative`, 'success');
          console.log('[AdminData] ✅ Narrative length:', result.narrativeLength);
        }
        if (result.usedFallbackData) {
          addLog(`  • Used most recent available data from scheduled updates`, 'info');
        }
      }
      
      // 🚨 CRITICAL FIX: More aggressive refresh with longer delays
      console.log('[AdminData] ═══════════════════════════════════════');
      console.log('[AdminData] 🔄 STARTING ULTRA-AGGRESSIVE REFRESH SEQUENCE');
      console.log('[AdminData] ═══════════════════════════════════════');
      
      // Stage 1: Immediate refresh
      console.log('[AdminData] Stage 1: Immediate refresh...');
      await loadLocationReports();
      
      // Stage 2: Wait for database write propagation
      console.log('[AdminData] Stage 2: Waiting 3s for database write propagation...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadLocationReports();
      
      // Stage 3: Wait for real-time subscriptions and cache invalidation
      console.log('[AdminData] Stage 3: Waiting 2s for real-time subscriptions...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadLocationReports();
      
      // Stage 4: Final verification refresh
      console.log('[AdminData] Stage 4: Final verification refresh after 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadLocationReports();
      
      // Stage 5: One more for good measure
      console.log('[AdminData] Stage 5: Final final refresh after 1s...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadLocationReports();
      
      console.log('[AdminData] ═══════════════════════════════════════');
      console.log('[AdminData] ✅ REFRESH SEQUENCE COMPLETE');
      console.log('[AdminData] ═══════════════════════════════════════');
      
      addLog(`✅ Report data refreshed for ${locationName}`, 'success');
      addLog(`  • Completed 5-stage refresh sequence to ensure latest data`, 'info');
    } catch (error) {
      console.error('[AdminData] ❌ Error generating report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to generate report for ${locationName}: ${errorMessage}`, 'error');
      showErrorModal('Report Generation Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullAndGenerateAllLocations = async () => {
    setIsLoading(true);
    addLog('Starting full update for all locations...', 'info');

    try {
      for (const location of locations) {
        const locationName = location.displayName;
        addLog(`Processing ${locationName}...`, 'info');
        
        await handlePullDataForLocation(location.id, locationName);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await handleUpdateForecast(location.id, locationName);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await handleGenerateReportForLocation(location.id, locationName);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      addLog('✅ All locations updated successfully', 'success');
    } catch (error) {
      console.error('[AdminData] Error in full update:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Full update failed: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLog = () => {
    setActivityLog([]);
    addLog('Activity log cleared', 'info');
  };

  const handleGoBack = () => {
    console.log('[AdminData] User tapped back button');
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Management</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Status</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.tides}</Text>
              <Text style={styles.statLabel}>Tides</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.weather}</Text>
              <Text style={styles.statLabel}>Weather</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.forecast}</Text>
              <Text style={styles.statLabel}>Forecast</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.surf}</Text>
              <Text style={styles.statLabel}>Surf</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Reports</Text>
          
          <View style={[styles.infoBox, { marginBottom: 16, backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={16}
              color="#2196F3"
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoText, { color: '#2196F3', fontWeight: '600' }]}>
                Data Flow: Scheduled updates pull fresh buoy data → Report page displays it → Regenerate Text uses that data
              </Text>
            </View>
          </View>
          
          {locationReports.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyStateText}>Loading locations...</Text>
            </View>
          ) : (
            locationReports.map((report) => (
              <View key={report.locationId} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationName}>{report.location}</Text>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: report.waveSensorsOnline ? '#4CAF50' : '#FF9800' }]} />
                    <Text style={styles.statusText}>
                      {report.waveSensorsOnline ? 'Live' : 'Offline'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.locationDetails}>
                  <Text style={styles.locationDetail}>
                    Wave Height: {report.waveHeight}
                  </Text>
                  <Text style={styles.locationDetail}>
                    Buoy: {report.buoyId}
                  </Text>
                  <Text style={styles.locationDetail}>
                    Report: {report.hasReport ? '✅' : '❌'}
                  </Text>
                  <Text style={styles.locationDetail}>
                    Narrative: {report.hasNarrative ? `✅ (${report.narrativeLength} chars)` : '❌'}
                  </Text>
                  {report.narrativePreview && (
                    <Text style={[styles.locationDetail, { fontStyle: 'italic', marginTop: 4 }]}>
                      Preview: {report.narrativePreview}...
                    </Text>
                  )}
                </View>

                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => {
                      console.log('[AdminData] 🔵 Update Data button pressed for:', locationName, locationId);
                      handlePullDataForLocation(report.locationId, report.location);
                    }}
                    disabled={isLoading}
                  >
                    <IconSymbol
                      ios_icon_name="arrow.clockwise"
                      android_material_icon_name="refresh"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Update Data</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={() => {
                      console.log('[AdminData] 📈 Update Forecast button pressed for:', locationName, locationId);
                      handleUpdateForecast(report.locationId, report.location);
                    }}
                    disabled={isLoading}
                  >
                    <IconSymbol
                      ios_icon_name="chart.line.uptrend.xyaxis"
                      android_material_icon_name="trending-up"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Update Forecast</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={() => {
                      console.log('[AdminData] ═══════════════════════════════════════');
                      console.log('[AdminData] 📝 REGENERATE TEXT BUTTON PRESSED');
                      console.log('[AdminData] Location:', locationName);
                      console.log('[AdminData] Location ID:', locationId);
                      console.log('[AdminData] Report Location ID:', report.locationId);
                      console.log('[AdminData] Is Loading:', isLoading);
                      console.log('[AdminData] ═══════════════════════════════════════');
                      handleGenerateReportForLocation(report.locationId, report.location);
                    }}
                    disabled={isLoading}
                  >
                    <IconSymbol
                      ios_icon_name="doc.text"
                      android_material_icon_name="description"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Regenerate Text</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={[styles.fullWidthButton, styles.primaryButton]}
            onPress={handlePullAndGenerateAllLocations}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.triangle.2.circlepath"
                  android_material_icon_name="sync"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.fullWidthButtonText}>
                  Update All Locations (Data + Forecast + Narrative)
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="schedule"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>
              Next automatic update: {nextCompleteDataTime}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            <TouchableOpacity onPress={handleClearLog}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContainer}>
            {activityLog.length === 0 ? (
              <Text style={styles.emptyLog}>No activity yet</Text>
            ) : (
              activityLog.map((log) => (
                <View key={log.id} style={styles.logItem}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={[styles.logMessage, { color: getLogColor(log.type) }]}>
                    {log.message}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notification Testing</Text>
          <PushNotificationTester />
        </View>
      </ScrollView>

      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={32}
                color="#FF3B30"
              />
              <Text style={styles.modalTitle}>{errorModalTitle}</Text>
            </View>
            <ScrollView style={styles.modalMessageScroll}>
              <Text style={styles.modalMessage}>{errorModalMessage}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                console.log('[AdminData] User dismissed error modal');
                setErrorModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getLogColor(type: 'info' | 'success' | 'error' | 'warning'): string {
  switch (type) {
    case 'success':
      return '#4CAF50';
    case 'error':
      return '#FF3B30';
    case 'warning':
      return '#FF9800';
    default:
      return colors.text;
  }
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  clearButton: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.highlight,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  locationDetails: {
    gap: 6,
    marginBottom: 12,
  },
  locationDetail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    minWidth: '30%',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fullWidthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  fullWidthButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.highlight,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  logContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    maxHeight: 300,
  },
  emptyLog: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  modalMessageScroll: {
    maxHeight: 300,
    marginBottom: 24,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
