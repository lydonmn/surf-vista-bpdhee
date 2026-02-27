
import { useState, useEffect, useCallback } from 'react';
import { getESTDate } from '@/utils/surfDataFormatter';
import { PushNotificationTester } from '@/components/PushNotificationTester';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from './integrations/supabase/client';
import { NotificationIntegrationStatus } from '@/components/NotificationIntegrationStatus';
import { colors } from '@/styles/commonStyles';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
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

function getLogColor(type: 'info' | 'success' | 'error' | 'warning'): string {
  switch (type) {
    case 'success': return '#22C55E';
    case 'error': return '#EF4444';
    case 'warning': return '#F59E0B';
    default: return colors.primary;
  }
}

export default function AdminDataScreen() {
  const router = useRouter();
  const { currentLocation, locationData, locations } = useLocation();
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCompleteDataTime, setNextCompleteDataTime] = useState<string>('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
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
      const today = getESTDate();
      
      const [tidesResult, weatherResult, forecastResult, surfResult] = await Promise.all([
        supabase.from('tide_data').select('id', { count: 'exact', head: true }).eq('location', currentLocation).gte('date', today),
        supabase.from('weather_data').select('id', { count: 'exact', head: true }).eq('location', currentLocation).eq('date', today),
        supabase.from('weather_forecast').select('id', { count: 'exact', head: true }).eq('location', currentLocation).gte('date', today),
        supabase.from('surf_conditions').select('id', { count: 'exact', head: true }).eq('location', currentLocation).eq('date', today),
      ]);

      setDataCounts({
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
        external: 0,
      });
    } catch (error) {
      console.error('Error loading data counts:', error);
    }
  }, [currentLocation]);

  const loadLocationReports = useCallback(async () => {
    try {
      const today = getESTDate();
      const reports: LocationReport[] = [];

      for (const loc of locations) {
        const { data: reportData } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('location', loc.id)
          .eq('date', today)
          .maybeSingle();

        const { data: surfData } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', loc.id)
          .eq('date', today)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const hasReport = !!reportData;
        const hasNarrative = !!(reportData?.conditions || reportData?.report_text);
        const narrativeText = reportData?.report_text || reportData?.conditions || '';
        const waveHeight = surfData?.surf_height || surfData?.wave_height || 'N/A';
        const waveSensorsOnline = waveHeight !== 'N/A' && waveHeight !== '' && waveHeight !== 'null';

        reports.push({
          location: loc.displayName,
          locationId: loc.id,
          date: today,
          hasReport,
          hasNarrative,
          narrativeLength: narrativeText.length,
          narrativePreview: narrativeText.substring(0, 100),
          waveHeight,
          waveSensorsOnline,
          lastUpdated: surfData?.updated_at || reportData?.updated_at || 'Never',
          buoyId: loc.buoyId,
        });
      }

      setLocationReports(reports);
    } catch (error) {
      console.error('Error loading location reports:', error);
    }
  }, [locations]);

  const calculateNextCompleteDataTime = useCallback(() => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const currentHour = estTime.getHours();
    const currentMinute = estTime.getMinutes();

    let nextHour = currentHour;
    let nextMinute = 20;

    if (currentMinute >= 20 && currentMinute < 50) {
      nextMinute = 50;
    } else if (currentMinute >= 50) {
      nextHour = (currentHour + 1) % 24;
      nextMinute = 20;
    }

    const nextTime = new Date(estTime);
    nextTime.setHours(nextHour, nextMinute, 0, 0);

    const minutesUntil = Math.floor((nextTime.getTime() - estTime.getTime()) / 60000);
    setNextCompleteDataTime(`${nextHour}:${nextMinute.toString().padStart(2, '0')} EST (in ${minutesUntil} min)`);
  }, []);

  useEffect(() => {
    loadDataCounts();
    loadLocationReports();
    calculateNextCompleteDataTime();
  }, [loadDataCounts, loadLocationReports, calculateNextCompleteDataTime]);

  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const handlePullDataForLocation = async (locationId: string, locationDisplayName: string) => {
    setIsLoading(true);
    addLog(`Starting data pull for ${locationDisplayName}...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('update-all-surf-data', {
        body: { location: locationId },
      });

      if (error) {
        addLog(`Error pulling data for ${locationDisplayName}: ${error.message}`, 'error');
        showErrorModal('Data Pull Failed', `Failed to pull data for ${locationDisplayName}: ${error.message}`);
      } else if (data?.success) {
        addLog(`✅ Data pulled successfully for ${locationDisplayName}`, 'success');
        await loadDataCounts();
        await loadLocationReports();
      } else {
        const errorMsg = data?.error || 'Unknown error';
        addLog(`Failed to pull data for ${locationDisplayName}: ${errorMsg}`, 'error');
        showErrorModal('Data Pull Failed', `Failed to pull data for ${locationDisplayName}: ${errorMsg}`);
      }
    } catch (error: any) {
      addLog(`Exception pulling data for ${locationDisplayName}: ${error.message}`, 'error');
      showErrorModal('Data Pull Failed', `Exception: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateForecast = async (locationId: string, locationDisplayName: string) => {
    setIsLoading(true);
    addLog(`Updating 7-day forecast for ${locationDisplayName}...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('fetch-surf-forecast', {
        body: { location: locationId },
      });

      if (error) {
        addLog(`Error updating forecast for ${locationDisplayName}: ${error.message}`, 'error');
        showErrorModal('Forecast Update Failed', `Failed to update forecast for ${locationDisplayName}: ${error.message}`);
      } else if (data?.success) {
        addLog(`✅ Forecast updated successfully for ${locationDisplayName}`, 'success');
        await loadDataCounts();
      } else {
        const errorMsg = data?.error || 'Unknown error';
        addLog(`Failed to update forecast for ${locationDisplayName}: ${errorMsg}`, 'error');
        showErrorModal('Forecast Update Failed', `Failed to update forecast for ${locationDisplayName}: ${errorMsg}`);
      }
    } catch (error: any) {
      addLog(`Exception updating forecast for ${locationDisplayName}: ${error.message}`, 'error');
      showErrorModal('Forecast Update Failed', `Exception: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReportForLocation = async (locationId: string, locationDisplayName: string) => {
    setIsLoading(true);
    addLog(`Generating report for ${locationDisplayName}...`, 'info');

    try {
      const { data, error } = await supabase.functions.invoke('daily-6am-report-with-retry', {
        body: { location: locationId, isManualTrigger: true },
      });

      if (error) {
        addLog(`Error generating report for ${locationDisplayName}: ${error.message}`, 'error');
        showErrorModal('Report Generation Failed', `Failed to generate report for ${locationDisplayName}: ${error.message}`);
      } else if (data?.success) {
        addLog(`✅ Report generated successfully for ${locationDisplayName}`, 'success');
        await loadLocationReports();
      } else {
        const errorMsg = data?.error || data?.message || 'Unknown error';
        addLog(`Failed to generate report for ${locationDisplayName}: ${errorMsg}`, 'error');
        showErrorModal('Report Generation Failed', `Failed to generate report for ${locationDisplayName}: ${errorMsg}`);
      }
    } catch (error: any) {
      addLog(`Exception generating report for ${locationDisplayName}: ${error.message}`, 'error');
      showErrorModal('Report Generation Failed', `Exception: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullAndGenerateAllLocations = async () => {
    setIsLoading(true);
    addLog('Starting full data pull and report generation for all locations...', 'info');

    for (const loc of locations) {
      addLog(`Processing ${loc.displayName}...`, 'info');
      
      try {
        const { data: pullData, error: pullError } = await supabase.functions.invoke('update-all-surf-data', {
          body: { location: loc.id },
        });

        if (pullError || !pullData?.success) {
          addLog(`❌ Data pull failed for ${loc.displayName}`, 'error');
          continue;
        }

        addLog(`✅ Data pulled for ${loc.displayName}`, 'success');

        const { data: reportData, error: reportError } = await supabase.functions.invoke('daily-6am-report-with-retry', {
          body: { location: loc.id, isManualTrigger: true },
        });

        if (reportError || !reportData?.success) {
          addLog(`❌ Report generation failed for ${loc.displayName}`, 'error');
        } else {
          addLog(`✅ Report generated for ${loc.displayName}`, 'success');
        }
      } catch (error: any) {
        addLog(`❌ Exception for ${loc.displayName}: ${error.message}`, 'error');
      }
    }

    await loadDataCounts();
    await loadLocationReports();
    setIsLoading(false);
    addLog('✅ All locations processed', 'success');
  };

  const handleClearLog = () => {
    setActivityLog([]);
    addLog('Activity log cleared', 'info');
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Management</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Location: {locationData.displayName}</Text>
        <Text style={styles.sectionSubtitle}>Buoy: {locationData.buoyId} | Tide Station: {locationData.tideStationId}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Counts (Today)</Text>
        <View style={styles.dataGrid}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Tides</Text>
            <Text style={styles.dataValue}>{dataCounts.tides}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Weather</Text>
            <Text style={styles.dataValue}>{dataCounts.weather}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Forecast</Text>
            <Text style={styles.dataValue}>{dataCounts.forecast}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>Surf</Text>
            <Text style={styles.dataValue}>{dataCounts.surf}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Reports</Text>
        {locationReports.map((report) => (
          <View key={report.locationId} style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationName}>{report.location}</Text>
              <View style={[styles.statusBadge, { backgroundColor: report.hasReport ? '#22C55E' : '#EF4444' }]}>
                <Text style={styles.statusText}>{report.hasReport ? 'Has Report' : 'No Report'}</Text>
              </View>
            </View>
            
            <View style={styles.locationDetails}>
              <Text style={styles.detailText}>Wave Height: {report.waveHeight}</Text>
              <Text style={styles.detailText}>Sensors: {report.waveSensorsOnline ? '✅ Online' : '❌ Offline'}</Text>
              <Text style={styles.detailText}>Narrative: {report.narrativeLength} chars</Text>
              <Text style={styles.detailText}>Last Updated: {new Date(report.lastUpdated).toLocaleTimeString()}</Text>
            </View>

            <View style={styles.locationActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => handlePullDataForLocation(report.locationId, report.location)}
                disabled={isLoading}
              >
                <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Pull Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => handleUpdateForecast(report.locationId, report.location)}
                disabled={isLoading}
              >
                <IconSymbol ios_icon_name="calendar" android_material_icon_name="calendar-today" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Forecast</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.accentButton]}
                onPress={() => handleGenerateReportForLocation(report.locationId, report.location)}
                disabled={isLoading}
              >
                <IconSymbol ios_icon_name="doc.text" android_material_icon_name="description" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bulk Actions</Text>
        <TouchableOpacity
          style={[styles.bulkButton, { backgroundColor: colors.accent }]}
          onPress={handlePullAndGenerateAllLocations}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol ios_icon_name="arrow.triangle.2.circlepath" android_material_icon_name="sync" size={20} color="#FFFFFF" />
              <Text style={styles.bulkButtonText}>Pull Data & Generate Reports for All Locations</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          <TouchableOpacity onPress={handleClearLog} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.logContainer}>
          {activityLog.length === 0 ? (
            <Text style={styles.emptyLog}>No activity yet</Text>
          ) : (
            activityLog.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <View style={[styles.logDot, { backgroundColor: getLogColor(log.type) }]} />
                <View style={styles.logContent}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Automated Data Collection</Text>
        <Text style={styles.infoText}>
          Data is automatically collected every 30 minutes at :20 and :50 past the hour.
        </Text>
        <Text style={styles.infoText}>
          Next scheduled update: {nextCompleteDataTime}
        </Text>
      </View>

      <View style={styles.section}>
        <NotificationIntegrationStatus />
      </View>

      <View style={styles.section}>
        <PushNotificationTester />
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: -8,
    marginBottom: 8,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dataItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  locationCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: '#6B7280',
  },
  accentButton: {
    backgroundColor: colors.accent,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  bulkButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logContainer: {
    maxHeight: 300,
  },
  emptyLog: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 24,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 14,
    color: '#374151',
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
