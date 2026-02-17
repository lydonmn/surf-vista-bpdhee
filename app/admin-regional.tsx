
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from './integrations/supabase/client';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
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
import { useLocation } from '@/contexts/LocationContext';

interface LocationItem {
  id: string;
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
  buoy_id: string;
  tide_station_id: string;
  is_active: boolean;
  created_at: string;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
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
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  locationInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  locationActions: {
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
  generateButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
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
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logMessage: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
});

export default function AdminRegionalScreen() {
  const { locations } = useLocation();
  const router = useRouter();
  const { profile } = useAuth();

  const [managedLocations, setManagedLocations] = useState<LocationItem[]>([]);
  const [loading] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  // Error modal state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (title: string, message: string) => {
    console.log('AdminRegionalScreen: Showing error:', title, message);
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[AdminRegionalScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setActivityLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    console.log('AdminRegionalScreen: Component mounted, profile:', profile);
    if (profile?.is_regional_admin && profile.managed_locations) {
      const managed = locations.filter(loc => 
        profile.managed_locations?.includes(loc.id)
      );
      console.log('AdminRegionalScreen: Managed locations:', managed);
      setManagedLocations(managed);
    }
  }, [profile, locations]);

  const handleGenerateReport = async (locationId: string, locationDisplayName: string) => {
    console.log('AdminRegionalScreen: Generate Report button clicked for:', locationDisplayName);
    addLog(`Generating report for ${locationDisplayName}...`, 'info');
    
    try {
      const { data, error } = await supabase.functions.invoke('daily-6am-report-with-retry', {
        body: { 
          locationId: locationId,
          isManualTrigger: true 
        },
      });

      if (error) {
        console.error('AdminRegionalScreen: Error generating report:', error);
        addLog(`❌ Failed to generate report for ${locationDisplayName}: ${error.message}`, 'error');
        showError('Error', `Failed to generate report: ${error.message}`);
        return;
      }

      if (data.success) {
        console.log('AdminRegionalScreen: ✅ Report generated successfully');
        addLog(`✅ Report generated successfully for ${locationDisplayName}`, 'success');
        showError('Success', `Report generated successfully for ${locationDisplayName}!`);
      } else {
        console.error('AdminRegionalScreen: Report generation returned error:', data.error);
        addLog(`⚠️ ${data.error || 'Unknown error'}`, 'warning');
        showError('Warning', data.error || 'Report generation completed with warnings');
      }
    } catch (err) {
      console.error('AdminRegionalScreen: Unexpected error generating report:', err);
      addLog(`❌ Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      showError('Error', 'An unexpected error occurred');
    }
  };

  const handleClearLog = () => {
    console.log('AdminRegionalScreen: Clearing activity log');
    setActivityLog([]);
  };

  const handleGoBack = () => {
    console.log('AdminRegionalScreen: Navigating back');
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.header}>Regional Admin</Text>

        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name="arrow.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {managedLocations.length === 0 ? (
          <Text style={styles.emptyText}>No locations assigned to you yet.</Text>
        ) : (
          managedLocations.map((location) => (
            <View key={location.id} style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <Text style={styles.locationName}>{location.display_name}</Text>
              </View>
              <Text style={styles.locationInfo}>ID: {location.id}</Text>
              <Text style={styles.locationInfo}>Buoy: {location.buoy_id}</Text>
              <Text style={styles.locationInfo}>Tide Station: {location.tide_station_id}</Text>
              
              <View style={styles.locationActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.generateButton]}
                  onPress={() => handleGenerateReport(location.id, location.display_name)}
                >
                  <Text style={styles.actionButtonText}>Generate Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

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
