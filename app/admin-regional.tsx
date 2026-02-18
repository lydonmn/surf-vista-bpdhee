
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
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from './integrations/supabase/client';
import { useRouter } from 'expo-router';
import { useLocation } from '@/contexts/LocationContext';

interface LocationReport {
  location: string;
  locationId: string;
  date: string;
  hasReport: boolean;
  hasNarrative: boolean;
  narrativeLength: number;
  waveHeight: string;
  lastUpdated: string;
}

export default function AdminRegionalScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { locations } = useLocation();
  
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const loadLocationReports = useCallback(async () => {
    if (!profile?.managed_locations || profile.managed_locations.length === 0) {
      console.log('[AdminRegional] No managed locations');
      return;
    }

    try {
      setIsRefreshing(true);
      
      const today = new Date().toISOString().split('T')[0];
      const reports: LocationReport[] = [];

      const managedLocations = locations.filter(loc => 
        profile.managed_locations?.includes(loc.id)
      );

      for (const location of managedLocations) {
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
          waveHeight: surfData?.wave_height_ft ? `${surfData.wave_height_ft} ft` : 'N/A',
          lastUpdated: surfData?.timestamp || 'Never',
        });
      }

      setLocationReports(reports);
    } catch (error) {
      console.error('Error loading location reports:', error);
      showErrorModal('Error', 'Failed to load location reports');
    } finally {
      setIsRefreshing(false);
    }
  }, [profile, locations]);

  useEffect(() => {
    if (profile) {
      loadLocationReports();
    }
  }, [profile, loadLocationReports]);

  const handleGenerateReport = async (locationId: string, locationName: string) => {
    try {
      setIsRefreshing(true);
      
      const { error } = await supabase.functions.invoke('generate-surf-report', {
        body: { locationId },
      });

      if (error) throw error;

      await loadLocationReports();
    } catch (error) {
      console.error('Error generating report:', error);
      showErrorModal('Error', `Failed to generate report for ${locationName}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (!profile?.is_regional_admin) {
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
          <Text style={styles.headerTitle}>Regional Admin</Text>
          <View style={styles.backButton} />
        </View>
        
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color="#FF6B6B"
          />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorMessage}>You do not have regional admin permissions</Text>
        </View>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Regional Admin</Text>
        <TouchableOpacity onPress={loadLocationReports} style={styles.backButton}>
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Managed Locations</Text>
          
          {locationReports.length === 0 ? (
            <Text style={styles.emptyText}>No managed locations</Text>
          ) : (
            locationReports.map((report, index) => (
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
                    <Text style={styles.detailLabel}>Narrative:</Text>
                    <Text style={styles.detailValue}>
                      {report.hasNarrative ? `${report.narrativeLength} chars` : 'Missing'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, isRefreshing && styles.disabledButton]}
                  onPress={() => handleGenerateReport(report.locationId, report.location)}
                  disabled={isRefreshing}
                >
                  <Text style={styles.actionButtonText}>Generate Report</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {isRefreshing && (
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
    paddingTop: 48,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 32,
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
  actionButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
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
