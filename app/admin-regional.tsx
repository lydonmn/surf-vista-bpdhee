
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
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';

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

export default function RegionalAdminScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { locations } = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLocationId, setLoadingLocationId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [managedLocations, setManagedLocations] = useState<string[]>([]);

  // Load managed locations for this regional admin
  useEffect(() => {
    if (profile && profile.is_regional_admin && profile.managed_locations) {
      console.log('[RegionalAdminScreen] Managed locations:', profile.managed_locations);
      setManagedLocations(profile.managed_locations);
    } else if (profile && !profile.is_regional_admin) {
      console.log('[RegionalAdminScreen] User is not a regional admin, redirecting...');
      showErrorModal('Access Denied', 'You do not have regional admin privileges');
      router.back();
    }
  }, [profile]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[RegionalAdminScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setActivityLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 50));
  }, []);

  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const loadLocationReports = useCallback(async (today: string) => {
    try {
      const reports: LocationReport[] = [];

      // Only load reports for managed locations
      const locationsToCheck = locations.filter(loc => managedLocations.includes(loc.id));

      for (const loc of locationsToCheck) {
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
  }, [locations, managedLocations]);

  useEffect(() => {
    if (managedLocations.length > 0) {
      const now = new Date();
      const estDateString = now.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const [month, day, year] = estDateString.split('/');
      const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      loadLocationReports(today);
    }
  }, [managedLocations, loadLocationReports]);

  const handlePullDataForLocation = async (locationId: string, locationName: string) => {
    console.log(`[RegionalAdminScreen] Pulling data for ${locationName}`);
    setLoadingLocationId(locationId);
    addLog(`Pulling fresh NOAA data for ${locationName}...`, 'info');

    try {
      const response = await supabase.functions.invoke('update-all-surf-data', {
        body: { location: locationId }
      });
      
      if (response.error) {
        addLog(`${locationName}: ${response.error.message}`, 'error');
        showErrorModal('Error', `Failed to pull data for ${locationName}: ${response.error.message}`);
      } else if (response.data?.success) {
        addLog(`${locationName}: Data pulled successfully`, 'success');
        showErrorModal('Success', `Fresh data pulled for ${locationName}!`);
        
        const now = new Date();
        const estDateString = now.toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const [month, day, year] = estDateString.split('/');
        const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        await loadLocationReports(today);
      } else {
        const errorMsg = response.data?.error || 'Unknown error';
        addLog(`${locationName}: ${errorMsg}`, 'warning');
        showErrorModal('Warning', `${locationName}: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`${locationName}: ${errorMsg}`, 'error');
      showErrorModal('Error', `Failed to pull data: ${errorMsg}`);
    } finally {
      setLoadingLocationId(null);
    }
  };

  const handleGenerateReportForLocation = async (locationId: string, locationName: string) => {
    console.log(`[RegionalAdminScreen] Generating report for ${locationName} (manual trigger)`);
    setLoadingLocationId(locationId);
    addLog(`Generating report for ${locationName}...`, 'info');
    addLog(`Manual trigger: Will use most recent available data from today`, 'info');

    try {
      const response = await supabase.functions.invoke('daily-5am-report-with-retry', {
        body: { location: locationId }
      });
      
      console.log('Generate report response:', response);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        console.error(`[RegionalAdminScreen] Function invocation error:`, errorMsg);
        addLog(`${locationName}: Function error - ${errorMsg}`, 'error');
        showErrorModal('Error', `Failed to invoke report function for ${locationName}:\n\n${errorMsg}`);
        return;
      }

      if (response.data?.success) {
        const results = response.data.results || [];
        const locationResult = results.find((r: any) => r.locationId === locationId);
        
        if (locationResult?.success) {
          const waveStatus = locationResult.hasWaveData ? 'Wave sensors online ✅' : 'Wave sensors offline ⚠️';
          const dataSource = locationResult.usedFallbackData ? 'Used most recent available data' : 'Used fresh data';
          addLog(`${locationName}: Report generated successfully`, 'success');
          addLog(`${locationName}: ${waveStatus}`, locationResult.hasWaveData ? 'success' : 'warning');
          addLog(`${locationName}: ${dataSource}`, 'info');
          
          let alertMessage = `✅ Report generated for ${locationName}!\n\n${waveStatus}\n${dataSource}`;
          
          if (!locationResult.hasWaveData) {
            alertMessage += '\n\n⚠️ Note: Wave sensors are temporarily offline on the buoy, but wind and water temperature data are available. The report includes all available conditions.';
          }
          
          showErrorModal('Success', alertMessage);
        } else {
          const errorMsg = locationResult?.error || 'Unknown error';
          addLog(`${locationName}: ${errorMsg}`, 'error');
          showErrorModal('Error', `Failed to generate report: ${errorMsg}`);
        }
        
        const now = new Date();
        const estDateString = now.toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const [month, day, year] = estDateString.split('/');
        const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        await loadLocationReports(today);
      } else if (response.data?.success === false) {
        const errorMsg = response.data?.error || response.data?.message || 'Report generation failed';
        console.error(`[RegionalAdminScreen] Function returned error:`, errorMsg);
        addLog(`${locationName}: ${errorMsg}`, 'error');
        showErrorModal('Error', `Report generation failed for ${locationName}:\n\n${errorMsg}`);
      } else {
        console.error(`[RegionalAdminScreen] Unexpected response format:`, response.data);
        const errorMsg = 'Unexpected response format from Edge Function';
        addLog(`${locationName}: ${errorMsg}`, 'error');
        showErrorModal('Error', `${errorMsg}\n\nResponse: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RegionalAdminScreen] Exception:`, error);
      addLog(`${locationName}: Exception - ${errorMsg}`, 'error');
      showErrorModal('Error', `Failed to generate report: ${errorMsg}`);
    } finally {
      setLoadingLocationId(null);
    }
  };

  const handleClearLog = () => {
    console.log('[RegionalAdminScreen] Clearing activity log');
    setActivityLog([]);
    addLog('Activity log cleared');
  };

  const handleGoBack = () => {
    console.log('[RegionalAdminScreen] Navigating back...');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/(home)');
    }
  };

  if (!profile?.is_regional_admin) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </View>
    );
  }

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'chevron-left';
  const backButtonText = 'Back';
  const headerTitleText = 'Regional Admin Panel';
  const sectionTitleText = 'Your Managed Locations';
  const logSectionTitle = 'Activity Log';
  const clearButtonText = 'Clear';
  const logEmptyText = 'No activity yet';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name={backIconName}
            android_material_icon_name={backMaterialIconName}
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            {backButtonText}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.infoTitle}>Regional Admin Access</Text>
          </View>
          <Text style={styles.infoText}>
            You can upload videos, update surf data, and generate reports for your assigned locations only.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push('/admin')}
        >
          <IconSymbol
            ios_icon_name="video.fill"
            android_material_icon_name="videocam"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.uploadButtonText}>Upload Video</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText}</Text>
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
            const sensorStatus = report.waveSensorsOnline ? 'Wave sensors online' : 'Wave sensors offline';
            const isLoadingThisLocation = loadingLocationId === report.locationId;
            
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
                
                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={[styles.locationActionButton, styles.pullDataButton, isLoadingThisLocation && styles.buttonDisabled]}
                    onPress={() => handlePullDataForLocation(report.locationId, report.location)}
                    disabled={isLoadingThisLocation || isLoading}
                  >
                    {isLoadingThisLocation ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <IconSymbol
                          ios_icon_name="arrow.down.circle"
                          android_material_icon_name="download"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.locationActionText}>Pull Data</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.locationActionButton, styles.generateReportButton, isLoadingThisLocation && styles.buttonDisabled]}
                    onPress={() => handleGenerateReportForLocation(report.locationId, report.location)}
                    disabled={isLoadingThisLocation || isLoading}
                  >
                    {isLoadingThisLocation ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <IconSymbol
                          ios_icon_name="doc.text"
                          android_material_icon_name="description"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.locationActionText}>Generate Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                
                {!report.waveSensorsOnline && (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                      NOAA buoy {report.buoyId} wave sensors are currently offline. Reports will show wind/water temp data only until sensors come back online. Manual triggers will use the most recent available data.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>{logSectionTitle}</Text>
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

      <Modal
        visible={errorModalVisible}
        transparent={true}
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
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSpacer: {
    width: 70,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  infoText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    marginLeft: 4,
  },
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
  },
  locationStatus: {
    fontSize: 26,
  },
  locationDetails: {
    gap: 6,
    marginBottom: 14,
    paddingLeft: 4,
  },
  locationDetailText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  locationDetailWarning: {
    color: '#ff9500',
    fontWeight: '600',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  locationActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pullDataButton: {
    backgroundColor: '#3B82F6',
  },
  generateReportButton: {
    backgroundColor: '#10B981',
  },
  locationActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 20,
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
