
import { supabase } from './integrations/supabase/client';
import { PushNotificationTester } from '@/components/PushNotificationTester';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  locationReportCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  locationReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationReportName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  locationReportDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationReportInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  locationReportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  pullButton: {
    backgroundColor: '#3B82F6',
  },
  forecastButton: {
    backgroundColor: '#8B5CF6',
  },
  generateButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logSection: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  clearLogButton: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    maxHeight: 300,
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
  },
  logMessage: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  errorCloseButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextCompleteDataCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  nextCompleteDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  nextCompleteDataTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#78350F',
    marginBottom: 4,
  },
  nextCompleteDataSubtext: {
    fontSize: 14,
    color: '#92400E',
  },
});

function getLogColor(type: 'info' | 'success' | 'error' | 'warning'): string {
  switch (type) {
    case 'success':
      return '#44ff44';
    case 'error':
      return '#ff4444';
    case 'warning':
      return '#ffaa00';
    default:
      return colors.text;
  }
}

export default function AdminDataScreen() {
  const { locations } = useLocation();
  const router = useRouter();

  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [nextCompleteDataTime, setNextCompleteDataTime] = useState<string>('');

  // Error modal state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showErrorModal = (title: string, message: string) => {
    console.log('AdminDataScreen: Showing error modal:', title, message);
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[AdminDataScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setActivityLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 50));
  }, []);

  const loadDataCounts = useCallback(async () => {
    console.log('AdminDataScreen: Loading data counts');
    try {
      const today = getESTDate();
      
      const [tidesRes, weatherRes, forecastRes, surfRes] = await Promise.all([
        supabase.from('tides').select('id', { count: 'exact', head: true }).gte('date', today),
        supabase.from('weather_forecasts').select('id', { count: 'exact', head: true }).gte('date', today),
        supabase.from('surf_forecasts').select('id', { count: 'exact', head: true }).gte('date', today),
        supabase.from('surf_conditions').select('id', { count: 'exact', head: true }).gte('date', today),
      ]);

      setDataCounts({
        tides: tidesRes.count || 0,
        weather: weatherRes.count || 0,
        forecast: forecastRes.count || 0,
        surf: surfRes.count || 0,
        external: 0,
      });
    } catch (err) {
      console.error('AdminDataScreen: Error loading data counts:', err);
      addLog('Failed to load data counts', 'error');
    }
  }, [addLog]);

  const loadLocationReports = useCallback(async () => {
    console.log('AdminDataScreen: Loading location reports');
    try {
      const today = getESTDate();
      
      const reports: LocationReport[] = [];
      
      for (const location of locations) {
        const { data: reportData } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('location', location.id)
          .eq('date', today)
          .single();

        const { data: conditionsData } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', location.id)
          .eq('date', today)
          .order('captured_at', { ascending: false })
          .limit(1)
          .single();

        const hasReport = !!reportData;
        const hasNarrative = !!reportData?.report_text;
        const narrativeLength = reportData?.report_text?.length || 0;
        const narrativePreview = reportData?.report_text?.substring(0, 100) || 'No narrative yet';
        const waveHeight = conditionsData?.surf_height_max 
          ? `${conditionsData.surf_height_min}-${conditionsData.surf_height_max} ft`
          : 'No data';
        const waveSensorsOnline = !!conditionsData;
        const lastUpdated = conditionsData?.captured_at || 'Never';

        reports.push({
          location: location.display_name,
          locationId: location.id,
          date: today,
          hasReport,
          hasNarrative,
          narrativeLength,
          narrativePreview,
          waveHeight,
          waveSensorsOnline,
          lastUpdated,
          buoyId: location.buoy_id,
        });
      }

      setLocationReports(reports);
    } catch (err) {
      console.error('AdminDataScreen: Error loading location reports:', err);
      addLog('Failed to load location reports', 'error');
    }
  }, [locations, addLog]);

  const calculateNextCompleteDataTime = useCallback(() => {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // NOAA updates hourly at :50 past the hour
    const nextHour = new Date(estNow);
    nextHour.setHours(estNow.getHours() + 1);
    nextHour.setMinutes(50);
    nextHour.setSeconds(0);
    
    const timeString = nextHour.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
    
    setNextCompleteDataTime(timeString);
  }, []);

  useEffect(() => {
    console.log('AdminDataScreen: Component mounted');
    loadDataCounts();
    loadLocationReports();
    calculateNextCompleteDataTime();
  }, [loadDataCounts, loadLocationReports, calculateNextCompleteDataTime]);

  const handlePullDataForLocation = async (locationId: string, locationDisplayName: string) => {
    console.log('AdminDataScreen: Pull Data button clicked for:', locationDisplayName);
    addLog(`Pulling data for ${locationDisplayName}...`, 'info');
    
    try {
      setLoading(true);
      
      // Call the fetch-surf-reports Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-surf-reports', {
        body: { location: locationId },
      });

      if (error) {
        console.error('AdminDataScreen: Error pulling data:', error);
        addLog(`❌ Failed to pull data for ${locationDisplayName}: ${error.message}`, 'error');
        showErrorModal('Error', `Failed to pull data: ${error.message}`);
        return;
      }

      if (data.success) {
        console.log('AdminDataScreen: ✅ Data pulled successfully');
        addLog(`✅ Data pulled successfully for ${locationDisplayName}`, 'success');
        showErrorModal('Success', `Data pulled successfully for ${locationDisplayName}!`);
        await loadDataCounts();
        await loadLocationReports();
      } else {
        console.error('AdminDataScreen: Data pull returned error:', data.error);
        addLog(`⚠️ ${data.error || 'Unknown error'}`, 'warning');
        showErrorModal('Warning', data.error || 'Data pull completed with warnings');
      }
    } catch (err) {
      console.error('AdminDataScreen: Unexpected error pulling data:', err);
      addLog(`❌ Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      showErrorModal('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateForecast = async (locationId: string, locationDisplayName: string) => {
    console.log('AdminDataScreen: Update Forecast button clicked for:', locationDisplayName);
    addLog(`Updating forecast for ${locationDisplayName}...`, 'info');
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('fetch-surf-forecast', {
        body: { location: locationId },
      });

      if (error) {
        console.error('AdminDataScreen: Error updating forecast:', error);
        addLog(`❌ Failed to update forecast for ${locationDisplayName}: ${error.message}`, 'error');
        showErrorModal('Error', `Failed to update forecast: ${error.message}`);
        return;
      }

      if (data.success) {
        console.log('AdminDataScreen: ✅ Forecast updated successfully');
        addLog(`✅ Forecast updated successfully for ${locationDisplayName}`, 'success');
        showErrorModal('Success', `Forecast updated successfully for ${locationDisplayName}!`);
        await loadDataCounts();
      } else {
        console.error('AdminDataScreen: Forecast update returned error:', data.error);
        addLog(`⚠️ ${data.error || 'Unknown error'}`, 'warning');
        showErrorModal('Warning', data.error || 'Forecast update completed with warnings');
      }
    } catch (err) {
      console.error('AdminDataScreen: Unexpected error updating forecast:', err);
      addLog(`❌ Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      showErrorModal('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReportForLocation = async (locationId: string, locationDisplayName: string) => {
    console.log('AdminDataScreen: Generate Report button clicked for:', locationDisplayName);
    addLog(`Generating report for ${locationDisplayName}...`, 'info');
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('daily-6am-report-with-retry', {
        body: { 
          locationId: locationId,
          isManualTrigger: true 
        },
      });

      if (error) {
        console.error('AdminDataScreen: Error generating report:', error);
        addLog(`❌ Failed to generate report for ${locationDisplayName}: ${error.message}`, 'error');
        showErrorModal('Error', `Failed to generate report: ${error.message}`);
        return;
      }

      if (data.success) {
        console.log('AdminDataScreen: ✅ Report generated successfully');
        addLog(`✅ Report generated successfully for ${locationDisplayName}`, 'success');
        
        // Aggressive refresh sequence with delays and cache-busting
        await new Promise(resolve => setTimeout(resolve, 3000));
        await loadLocationReports();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadLocationReports();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadLocationReports();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadLocationReports();
        
        showErrorModal('Success', `Report generated successfully for ${locationDisplayName}!\n\nThe narrative has been updated and should now be visible on the report page.`);
      } else {
        console.error('AdminDataScreen: Report generation returned error:', data.error);
        addLog(`⚠️ ${data.error || 'Unknown error'}`, 'warning');
        showErrorModal('Warning', data.error || 'Report generation completed with warnings');
      }
    } catch (err) {
      console.error('AdminDataScreen: Unexpected error generating report:', err);
      addLog(`❌ Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      showErrorModal('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePullAndGenerateAllLocations = async () => {
    console.log('AdminDataScreen: Pull & Generate All button clicked');
    addLog('Starting full data pull and report generation for all locations...', 'info');
    
    try {
      setLoading(true);
      
      for (const location of locations) {
        addLog(`Processing ${location.display_name}...`, 'info');
        
        // Pull data
        const pullResponse = await supabase.functions.invoke('fetch-surf-reports', {
          body: { location: location.id },
        });
        
        if (pullResponse.error || !pullResponse.data?.success) {
          addLog(`⚠️ Data pull failed for ${location.display_name}`, 'warning');
          continue;
        }
        
        addLog(`✅ Data pulled for ${location.display_name}`, 'success');
        
        // Generate report
        const reportResponse = await supabase.functions.invoke('daily-6am-report-with-retry', {
          body: { 
            locationId: location.id,
            isManualTrigger: true 
          },
        });
        
        if (reportResponse.error || !reportResponse.data?.success) {
          addLog(`⚠️ Report generation failed for ${location.display_name}`, 'warning');
          continue;
        }
        
        addLog(`✅ Report generated for ${location.display_name}`, 'success');
        
        // Small delay between locations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      addLog('🎉 All locations processed!', 'success');
      showErrorModal('Success', 'All locations have been processed! Data pulled and reports generated.');
      
      await loadDataCounts();
      await loadLocationReports();
    } catch (err) {
      console.error('AdminDataScreen: Error in bulk operation:', err);
      addLog(`❌ Bulk operation failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      showErrorModal('Error', 'An error occurred during bulk processing');
    } finally {
      setLoading(false);
    }
  };

  const handleClearLog = () => {
    console.log('AdminDataScreen: Clearing activity log');
    setActivityLog([]);
  };

  const handleGoBack = () => {
    console.log('AdminDataScreen: Navigating back');
    router.back();
  };

  if (loading && locationReports.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tidesCountText = dataCounts.tides.toString();
  const weatherCountText = dataCounts.weather.toString();
  const forecastCountText = dataCounts.forecast.toString();
  const surfCountText = dataCounts.surf.toString();

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.header}>Admin Data Manager</Text>

        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name="arrow.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.backButtonText}>Back to Admin</Text>
        </TouchableOpacity>

        {/* Next Complete Data Time */}
        {nextCompleteDataTime && (
          <View style={styles.nextCompleteDataCard}>
            <Text style={styles.nextCompleteDataTitle}>⏰ Next NOAA Data Update</Text>
            <Text style={styles.nextCompleteDataTime}>{nextCompleteDataTime} EST</Text>
            <Text style={styles.nextCompleteDataSubtext}>
              NOAA updates hourly at :50 past the hour
            </Text>
          </View>
        )}

        {/* Data Counts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Data</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tides</Text>
            <Text style={styles.cardValue}>{tidesCountText}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weather Forecasts</Text>
            <Text style={styles.cardValue}>{weatherCountText}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Surf Forecasts</Text>
            <Text style={styles.cardValue}>{forecastCountText}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Surf Conditions</Text>
            <Text style={styles.cardValue}>{surfCountText}</Text>
          </View>
        </View>

        {/* Bulk Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bulk Actions</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handlePullAndGenerateAllLocations}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Pull & Generate All Locations</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Location Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Reports</Text>
          {locationReports.map((report) => {
            const hasReportText = report.hasReport ? 'Yes' : 'No';
            const hasNarrativeText = report.hasNarrative ? 'Yes' : 'No';
            const narrativeLengthText = `${report.narrativeLength} chars`;
            const waveSensorsText = report.waveSensorsOnline ? 'Online' : 'Offline';
            
            return (
              <View key={report.locationId} style={styles.locationReportCard}>
                <View style={styles.locationReportHeader}>
                  <Text style={styles.locationReportName}>{report.location}</Text>
                  <Text style={styles.locationReportDate}>{report.date}</Text>
                </View>
                <Text style={styles.locationReportInfo}>Report: {hasReportText}</Text>
                <Text style={styles.locationReportInfo}>Narrative: {hasNarrativeText} ({narrativeLengthText})</Text>
                <Text style={styles.locationReportInfo}>Wave Height: {report.waveHeight}</Text>
                <Text style={styles.locationReportInfo}>Buoy {report.buoyId}: {waveSensorsText}</Text>
                <Text style={styles.locationReportInfo}>Last Updated: {report.lastUpdated}</Text>
                <Text style={styles.locationReportInfo}>Preview: {report.narrativePreview}</Text>
                
                <View style={styles.locationReportActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.pullButton]}
                    onPress={() => handlePullDataForLocation(report.locationId, report.location)}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>Pull Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.forecastButton]}
                    onPress={() => handleUpdateForecast(report.locationId, report.location)}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>Update Forecast</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.generateButton]}
                    onPress={() => handleGenerateReportForLocation(report.locationId, report.location)}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>Generate Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Push Notification Tester */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <PushNotificationTester />
        </View>

        {/* Activity Log */}
        {activityLog.length > 0 && (
          <View style={styles.logSection}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>Activity Log</Text>
              <TouchableOpacity onPress={handleClearLog}>
                <Text style={styles.clearLogButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logContainer}>
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
            </View>
          </View>
        )}
      </ScrollView>

      {/* Error/Success Modal */}
      <Modal
        visible={errorModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorTitle}>{errorTitle}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.errorCloseButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.errorCloseButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
