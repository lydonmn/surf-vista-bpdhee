
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
import { PushNotificationTester } from '@/components/PushNotificationTester';
import { getESTDate } from '@/utils/surfDataFormatter';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from './integrations/supabase/client';
import { useRouter } from 'expo-router';
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
  narrativePreview: string;
  waveHeight: string;
  waveSensorsOnline: boolean;
  lastUpdated: string;
  buoyId: string;
}

const getLogColor = (type: 'info' | 'success' | 'error' | 'warning') => {
  switch (type) {
    case 'success': return '#4CAF50';
    case 'error': return '#FF6B6B';
    case 'warning': return '#FFA726';
    default: return colors.text;
  }
};

export default function AdminDataScreen() {
  const router = useRouter();
  const { locations } = useLocation();
  
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCompleteDataTime, setNextCompleteDataTime] = useState<string>('');
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const addLog = useCallback((message: string, type: ActivityLog['type'] = 'info') => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setActivityLog(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  const loadDataCounts = useCallback(async () => {
    try {
      addLog('Loading data counts...', 'info');
      
      const [tidesResult, weatherResult, forecastResult, surfResult, externalResult] = await Promise.all([
        supabase.from('tides').select('id', { count: 'exact', head: true }),
        supabase.from('weather').select('id', { count: 'exact', head: true }),
        supabase.from('forecast').select('id', { count: 'exact', head: true }),
        supabase.from('surf_data').select('id', { count: 'exact', head: true }),
        supabase.from('external_surf_data').select('id', { count: 'exact', head: true }),
      ]);

      setDataCounts({
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
        external: externalResult.count || 0,
      });

      addLog('Data counts loaded successfully', 'success');
    } catch (error) {
      console.error('Error loading data counts:', error);
      addLog('Failed to load data counts', 'error');
    }
  }, [addLog]);

  const loadLocationReports = useCallback(async () => {
    try {
      addLog('Loading location reports...', 'info');
      
      const today = getESTDate();
      const reports: LocationReport[] = [];

      for (const location of locations) {
        const [surfResult, narrativeResult] = await Promise.all([
          supabase
            .from('surf_data')
            .select('*')
            .eq('location_id', location.id)
            .eq('date', today)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('surf_reports')
            .select('narrative')
            .eq('location_id', location.id)
            .eq('date', today)
            .maybeSingle(),
        ]);

        const surfData = surfResult.data;
        const narrative = narrativeResult.data?.narrative || '';

        reports.push({
          location: location.display_name,
          locationId: location.id,
          date: today,
          hasReport: !!surfData,
          hasNarrative: narrative.length > 0,
          narrativeLength: narrative.length,
          narrativePreview: narrative.substring(0, 100),
          waveHeight: surfData?.wave_height_ft ? `${surfData.wave_height_ft} ft` : 'N/A',
          waveSensorsOnline: !!surfData?.wave_height_ft,
          lastUpdated: surfData?.timestamp || 'Never',
          buoyId: location.buoy_id,
        });
      }

      setLocationReports(reports);
      addLog(`Loaded reports for ${reports.length} locations`, 'success');
    } catch (error) {
      console.error('Error loading location reports:', error);
      addLog('Failed to load location reports', 'error');
    }
  }, [locations, addLog]);

  const calculateNextCompleteDataTime = useCallback(() => {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const currentHour = estNow.getHours();
    
    let nextHour = 6;
    if (currentHour >= 6 && currentHour < 12) {
      nextHour = 12;
    } else if (currentHour >= 12 && currentHour < 18) {
      nextHour = 18;
    } else if (currentHour >= 18) {
      nextHour = 6;
    }
    
    const nextRun = new Date(estNow);
    if (nextHour === 6 && currentHour >= 18) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    nextRun.setHours(nextHour, 0, 0, 0);
    
    const timeString = nextRun.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });
    
    setNextCompleteDataTime(`${timeString} EST`);
  }, []);

  useEffect(() => {
    loadDataCounts();
    loadLocationReports();
    calculateNextCompleteDataTime();
  }, [loadDataCounts, loadLocationReports, calculateNextCompleteDataTime]);

  const handlePullDataForLocation = async (locationId: string, locationDisplayName: string) => {
    setIsLoading(true);
    addLog(`Pulling data for ${locationDisplayName}...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('pull-surf-data', {
        body: { locationId },
      });

      if (error) throw error;

      addLog(`✅ Data pulled successfully for ${locationDisplayName}`, 'success');
      await loadDataCounts();
      await loadLocationReports();
    } catch (error) {
      console.error('Error pulling data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to pull data for ${locationDisplayName}: ${errorMessage}`, 'error');
      showErrorModal('Data Pull Failed', `Could not pull data for ${locationDisplayName}. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateForecast = async (locationId: string, locationDisplayName: string) => {
    setIsLoading(true);
    addLog(`Updating forecast for ${locationDisplayName}...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('update-forecast', {
        body: { locationId },
      });

      if (error) throw error;

      addLog(`✅ Forecast updated for ${locationDisplayName}`, 'success');
      await loadDataCounts();
      await loadLocationReports();
    } catch (error) {
      console.error('Error updating forecast:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to update forecast for ${locationDisplayName}: ${errorMessage}`, 'error');
      showErrorModal('Forecast Update Failed', `Could not update forecast for ${locationDisplayName}. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReportForLocation = async (locationId: string, locationDisplayName: string) => {
    setIsLoading(true);
    addLog(`Generating report for ${locationDisplayName}...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('generate-surf-report', {
        body: { locationId },
      });

      if (error) throw error;

      addLog(`✅ Report generated for ${locationDisplayName}`, 'success');
      await loadLocationReports();
    } catch (error) {
      console.error('Error generating report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to generate report for ${locationDisplayName}: ${errorMessage}`, 'error');
      showErrorModal('Report Generation Failed', `Could not generate report for ${locationDisplayName}. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullAndGenerateAllLocations = async () => {
    setIsLoading(true);
    addLog('Starting complete data refresh for all locations...', 'info');

    for (const location of locations) {
      addLog(`Processing ${location.display_name}...`, 'info');
      
      try {
        addLog(`  → Pulling data for ${location.display_name}`, 'info');
        const pullResult = await supabase.functions.invoke('pull-surf-data', {
          body: { locationId: location.id },
        });
        if (pullResult.error) throw pullResult.error;
        addLog(`  ✅ Data pulled for ${location.display_name}`, 'success');

        addLog(`  → Updating forecast for ${location.display_name}`, 'info');
        const forecastResult = await supabase.functions.invoke('update-forecast', {
          body: { locationId: location.id },
        });
        if (forecastResult.error) throw forecastResult.error;
        addLog(`  ✅ Forecast updated for ${location.display_name}`, 'success');

        addLog(`  → Generating report for ${location.display_name}`, 'info');
        const reportResult = await supabase.functions.invoke('generate-surf-report', {
          body: { locationId: location.id },
        });
        if (reportResult.error) throw reportResult.error;
        addLog(`  ✅ Report generated for ${location.display_name}`, 'success');
      } catch (error) {
        console.error(`Error processing ${location.display_name}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog(`  ❌ Failed to process ${location.display_name}: ${errorMessage}`, 'error');
      }
    }

    addLog('✅ Complete data refresh finished for all locations', 'success');
    await loadDataCounts();
    await loadLocationReports();
    setIsLoading(false);
  };

  const handleClearLog = () => {
    setActivityLog([]);
    addLog('Activity log cleared', 'info');
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Management</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Overview</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.tides}</Text>
              <Text style={styles.statLabel}>Tide Records</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.weather}</Text>
              <Text style={styles.statLabel}>Weather Records</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.forecast}</Text>
              <Text style={styles.statLabel}>Forecast Records</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.surf}</Text>
              <Text style={styles.statLabel}>Surf Data</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dataCounts.external}</Text>
              <Text style={styles.statLabel}>External Data</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automated Updates</Text>
          <View style={styles.infoCard}>
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="schedule"
              size={20}
              color={colors.primary}
            />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Next Scheduled Update</Text>
              <Text style={styles.infoValue}>{nextCompleteDataTime}</Text>
            </View>
          </View>
          
          <Text style={styles.infoText}>
            Data automatically refreshes at 6 AM, 12 PM, and 6 PM EST daily
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, isLoading && styles.disabledButton]}
            onPress={handlePullAndGenerateAllLocations}
            disabled={isLoading}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>
              {isLoading ? 'Processing...' : 'Pull & Generate All Locations'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Location Reports</Text>
            <TouchableOpacity onPress={loadLocationReports}>
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {locationReports.map((report, index) => (
            <View key={index} style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <Text style={styles.locationName}>{report.location}</Text>
                <View style={styles.statusBadge}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: report.hasReport && report.hasNarrative ? '#4CAF50' : '#FF6B6B' }
                  ]} />
                  <Text style={styles.statusText}>
                    {report.hasReport && report.hasNarrative ? 'Complete' : 'Incomplete'}
                  </Text>
                </View>
              </View>

              <View style={styles.locationDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Wave Height:</Text>
                  <Text style={styles.detailValue}>{report.waveHeight}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Sensors:</Text>
                  <Text style={[
                    styles.detailValue,
                    { color: report.waveSensorsOnline ? '#4CAF50' : '#FF6B6B' }
                  ]}>
                    {report.waveSensorsOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Narrative:</Text>
                  <Text style={styles.detailValue}>
                    {report.hasNarrative ? `${report.narrativeLength} chars` : 'Missing'}
                  </Text>
                </View>
              </View>

              <View style={styles.locationActions}>
                <TouchableOpacity
                  style={[styles.smallButton, isLoading && styles.disabledButton]}
                  onPress={() => handlePullDataForLocation(report.locationId, report.location)}
                  disabled={isLoading}
                >
                  <Text style={styles.smallButtonText}>Pull Data</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.smallButton, isLoading && styles.disabledButton]}
                  onPress={() => handleUpdateForecast(report.locationId, report.location)}
                  disabled={isLoading}
                >
                  <Text style={styles.smallButtonText}>Update Forecast</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.smallButton, isLoading && styles.disabledButton]}
                  onPress={() => handleGenerateReportForLocation(report.locationId, report.location)}
                  disabled={isLoading}
                >
                  <Text style={styles.smallButtonText}>Generate Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            <TouchableOpacity onPress={handleClearLog}>
              <Text style={styles.clearLogText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logContainer}>
            {activityLog.length === 0 ? (
              <Text style={styles.emptyLogText}>No activity yet</Text>
            ) : (
              activityLog.map((log) => (
                <View key={log.id} style={styles.logEntry}>
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

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{errorModalTitle}</Text>
            <Text style={styles.modalMessage}>{errorModalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? 48 : 12,
    paddingBottom: 12,
    backgroundColor: colors.card,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  locationCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
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
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  smallButton: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyLogText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  logEntry: {
    paddingVertical: 6,
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
  clearLogText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
