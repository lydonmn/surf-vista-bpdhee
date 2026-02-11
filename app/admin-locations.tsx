
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from './integrations/supabase/client';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import React from 'react';
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Increased padding to ensure all fields are accessible
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
  addButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    minWidth: 80,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  toggleButton: {
    backgroundColor: colors.textSecondary,
  },
  testButton: {
    backgroundColor: '#3B82F6',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '90%',
  },
  modalHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    marginTop: 12,
  },
  inputHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
  testLogSection: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  testLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  testLogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  clearLogButton: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  testLogContainer: {
    maxHeight: 300,
  },
  testLogEntry: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  testLogTimestamp: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  testLogMessage: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  testLogError: {
    color: '#ff4444',
  },
  testLogSuccess: {
    color: '#44ff44',
  },
  testLogWarning: {
    color: '#ffaa00',
  },
  helpCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 22,
    marginBottom: 12,
  },
  helpExample: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
  },
});

export default function AdminLocationsScreen() {
  const { refreshLocations } = useLocation();
  const router = useRouter();
  const { profile } = useAuth();

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    display_name: '',
    latitude: '',
    longitude: '',
    buoy_id: '',
    tide_station_id: '',
    is_active: true,
  });

  useEffect(() => {
    console.log('AdminLocationsScreen: Component mounted, profile:', profile);
    if (profile) {
      loadLocations();
    }
  }, [profile]);

  const loadLocations = async () => {
    console.log('AdminLocationsScreen: Loading locations');
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) {
        console.error('AdminLocationsScreen: Error loading locations:', error);
        Alert.alert('Error', `Failed to load locations: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: Loaded locations:', data);
      setLocations(data || []);
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      display_name: '',
      latitude: '',
      longitude: '',
      buoy_id: '',
      tide_station_id: '',
      is_active: true,
    });
    setEditingLocation(null);
  };

  const openAddModal = () => {
    console.log('AdminLocationsScreen: Opening add modal');
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (location: LocationItem) => {
    console.log('AdminLocationsScreen: Opening edit modal for:', location);
    setEditingLocation(location);
    setFormData({
      id: location.id,
      name: location.name,
      display_name: location.display_name,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      buoy_id: location.buoy_id,
      tide_station_id: location.tide_station_id,
      is_active: location.is_active,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    console.log('AdminLocationsScreen: Closing modal');
    setModalVisible(false);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!formData.id.trim()) {
      Alert.alert('Validation Error', 'Location ID is required');
      return false;
    }
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Location Name is required');
      return false;
    }
    if (!formData.display_name.trim()) {
      Alert.alert('Validation Error', 'Display Name is required');
      return false;
    }
    if (!formData.latitude.trim() || isNaN(parseFloat(formData.latitude))) {
      Alert.alert('Validation Error', 'Valid Latitude is required');
      return false;
    }
    if (!formData.longitude.trim() || isNaN(parseFloat(formData.longitude))) {
      Alert.alert('Validation Error', 'Valid Longitude is required');
      return false;
    }
    if (!formData.buoy_id.trim()) {
      Alert.alert('Validation Error', 'NOAA Buoy ID is required');
      return false;
    }
    if (!formData.tide_station_id.trim()) {
      Alert.alert('Validation Error', 'NOAA Tide Station ID is required');
      return false;
    }
    return true;
  };

  const handleSaveLocation = async () => {
    console.log('AdminLocationsScreen: Saving location:', formData);
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const locationData = {
        id: formData.id.toLowerCase().replace(/\s+/g, '-'),
        name: formData.name,
        display_name: formData.display_name,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        buoy_id: formData.buoy_id,
        tide_station_id: formData.tide_station_id,
        is_active: formData.is_active,
      };

      let error;
      if (editingLocation) {
        console.log('AdminLocationsScreen: Updating location:', locationData);
        const { error: updateError } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', editingLocation.id);
        error = updateError;
      } else {
        console.log('AdminLocationsScreen: Inserting new location:', locationData);
        const { error: insertError } = await supabase
          .from('locations')
          .insert(locationData);
        error = insertError;
      }

      if (error) {
        console.error('AdminLocationsScreen: Error saving location:', error);
        Alert.alert('Error', `Failed to save location: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: Location saved successfully');
      Alert.alert('Success', 'Location saved successfully!');
      closeModal();
      await loadLocations();
      await refreshLocations();
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error saving location:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (location: LocationItem) => {
    console.log('AdminLocationsScreen: Toggling active status for:', location);
    try {
      setLoading(true);
      const { error } = await supabase
        .from('locations')
        .update({ is_active: !location.is_active })
        .eq('id', location.id);

      if (error) {
        console.error('AdminLocationsScreen: Error toggling active status:', error);
        Alert.alert('Error', `Failed to update location: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: Active status toggled successfully');
      await loadLocations();
      await refreshLocations();
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error toggling active:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLocation = async (location: LocationItem) => {
    console.log('AdminLocationsScreen: Testing location data sources:', location);
    setLoading(true);
    
    try {
      addLog(`Testing data sources for ${location.display_name}...`, 'info');
      
      // Test 1: Fetch surf data from buoy
      addLog(`Testing NOAA Buoy ${location.buoy_id}...`, 'info');
      const surfResponse = await supabase.functions.invoke('fetch-surf-reports', {
        body: { location: location.id },
      });
      
      if (surfResponse.error) {
        addLog(`❌ Buoy test failed: ${surfResponse.error.message}`, 'error');
      } else if (surfResponse.data?.success) {
        addLog(`✅ Buoy ${location.buoy_id} is working! Wave data retrieved.`, 'success');
      } else {
        addLog(`⚠️ Buoy test returned: ${surfResponse.data?.error || 'Unknown error'}`, 'warning');
      }
      
      // Test 2: Fetch weather data
      addLog(`Testing NOAA Weather for coordinates (${location.latitude}, ${location.longitude})...`, 'info');
      const weatherResponse = await supabase.functions.invoke('fetch-weather-data', {
        body: { location: location.id },
      });
      
      if (weatherResponse.error) {
        addLog(`❌ Weather test failed: ${weatherResponse.error.message}`, 'error');
      } else if (weatherResponse.data?.success) {
        addLog(`✅ Weather API is working! ${weatherResponse.data.forecast_periods || 0} forecast periods retrieved.`, 'success');
      } else {
        addLog(`⚠️ Weather test returned: ${weatherResponse.data?.error || 'Unknown error'}`, 'warning');
      }
      
      // Test 3: Fetch tide data
      addLog(`Testing NOAA Tide Station ${location.tide_station_id}...`, 'info');
      const tideResponse = await supabase.functions.invoke('fetch-tide-data', {
        body: { location: location.id },
      });
      
      if (tideResponse.error) {
        addLog(`❌ Tide test failed: ${tideResponse.error.message}`, 'error');
      } else if (tideResponse.data?.success) {
        addLog(`✅ Tide Station ${location.tide_station_id} is working! ${tideResponse.data.tides || 0} tide records retrieved.`, 'success');
      } else {
        addLog(`⚠️ Tide test returned: ${tideResponse.data?.error || 'Unknown error'}`, 'warning');
      }
      
      // Summary
      const allSuccess = 
        surfResponse.data?.success && 
        weatherResponse.data?.success && 
        tideResponse.data?.success;
      
      if (allSuccess) {
        addLog(`🎉 All data sources working for ${location.display_name}!`, 'success');
        Alert.alert(
          'Test Successful!',
          `All data sources are working correctly for ${location.display_name}:\n\n✅ Buoy ${location.buoy_id}\n✅ Weather (${location.latitude}, ${location.longitude})\n✅ Tide Station ${location.tide_station_id}\n\nThis location is ready to generate reports!`
        );
      } else {
        Alert.alert(
          'Test Results',
          `Some data sources may have issues for ${location.display_name}. Check the activity log for details.`
        );
      }
      
    } catch (err) {
      console.error('AdminLocationsScreen: Error testing location:', err);
      addLog(`❌ Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      Alert.alert('Error', 'Failed to test location data sources');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = (location: LocationItem) => {
    console.log('AdminLocationsScreen: Delete requested for:', location);
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${location.display_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('AdminLocationsScreen: Deleting location:', location);
            try {
              setLoading(true);
              const { error } = await supabase
                .from('locations')
                .delete()
                .eq('id', location.id);

              if (error) {
                console.error('AdminLocationsScreen: Error deleting location:', error);
                Alert.alert('Error', `Failed to delete location: ${error.message}`);
                return;
              }

              console.log('AdminLocationsScreen: Location deleted successfully');
              Alert.alert('Success', 'Location deleted successfully!');
              await loadLocations();
              await refreshLocations();
            } catch (err) {
              console.error('AdminLocationsScreen: Unexpected error deleting:', err);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Activity log state for test results
  const [testLog, setTestLog] = useState<ActivityLog[]>([]);
  
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[AdminLocationsScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setTestLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 20));
  }, []);

  const handleGoBack = () => {
    console.log('AdminLocationsScreen: Navigating back');
    router.back();
  };

  if (loading && locations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeText = 'Active';
  const inactiveText = 'Inactive';

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.header}>Manage Locations</Text>

        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name="arrow.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.backButtonText}>Back to Admin</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ Add New Location</Text>
        </TouchableOpacity>

        {/* Help Guide */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>📚 How to Add a New Location</Text>
          <Text style={styles.helpText}>
            1. Find NOAA Buoy ID at: ndbc.noaa.gov{'\n'}
            2. Find Tide Station ID at: tidesandcurrents.noaa.gov{'\n'}
            3. Get coordinates from Google Maps{'\n'}
            4. Add location and click "Test Data" to verify{'\n'}
            5. If test passes, activate the location!
          </Text>
          <Text style={styles.helpExample}>
            Example (Holden Beach, NC):{'\n'}
            • Buoy: 41013 (Frying Pan Shoals){'\n'}
            • Tide Station: 8658163 (Wrightsville Beach){'\n'}
            • Coordinates: 33.9176, -78.3086
          </Text>
        </View>

        {locations.length === 0 ? (
          <Text style={styles.emptyText}>No locations yet. Add your first location!</Text>
        ) : (
          locations.map((location) => {
            const statusText = location.is_active ? activeText : inactiveText;
            return (
              <View key={location.id} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationName}>{location.display_name}</Text>
                </View>
                <Text style={styles.locationInfo}>ID: {location.id}</Text>
                <Text style={styles.locationInfo}>Name: {location.name}</Text>
                <Text style={styles.locationInfo}>
                  Coordinates: {location.latitude}, {location.longitude}
                </Text>
                <Text style={styles.locationInfo}>Buoy: {location.buoy_id}</Text>
                <Text style={styles.locationInfo}>Tide Station: {location.tide_station_id}</Text>
                <View
                  style={[
                    styles.activeIndicator,
                    { backgroundColor: location.is_active ? '#34C759' : '#8E8E93' },
                  ]}
                >
                  <Text style={[styles.activeText, { color: '#FFFFFF' }]}>
                    {statusText}
                  </Text>
                </View>
                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.testButton]}
                    onPress={() => handleTestLocation(location)}
                  >
                    <Text style={styles.actionButtonText}>Test Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.toggleButton]}
                    onPress={() => handleToggleActive(location)}
                  >
                    <Text style={styles.actionButtonText}>
                      {location.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => openEditModal(location)}
                  >
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteLocation(location)}
                  >
                    <Text style={styles.actionButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Test Log */}
        {testLog.length > 0 && (
          <View style={styles.testLogSection}>
            <View style={styles.testLogHeader}>
              <Text style={styles.testLogTitle}>Test Results</Text>
              <TouchableOpacity onPress={() => setTestLog([])}>
                <Text style={styles.clearLogButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.testLogContainer}>
              {testLog.map((log) => {
                const logTimestampText = `[${log.timestamp}]`;
                return (
                  <View key={log.id} style={styles.testLogEntry}>
                    <Text style={styles.testLogTimestamp}>{logTimestampText}</Text>
                    <Text style={[
                      styles.testLogMessage,
                      log.type === 'error' && styles.testLogError,
                      log.type === 'success' && styles.testLogSuccess,
                      log.type === 'warning' && styles.testLogWarning,
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

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </Text>

            <ScrollView 
              style={{ maxHeight: '70%' }}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.inputLabel}>Location ID (URL-friendly, e.g., "myrtle-beach")</Text>
              <TextInput
                style={styles.input}
                value={formData.id}
                onChangeText={(text) =>
                  setFormData({ ...formData, id: text.toLowerCase().replace(/\s+/g, '-') })
                }
                placeholder="e.g., holden-beach"
                placeholderTextColor={colors.textSecondary}
                editable={!editingLocation}
              />

              <Text style={styles.inputLabel}>Location Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Holden Beach"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={formData.display_name}
                onChangeText={(text) => setFormData({ ...formData, display_name: text })}
                placeholder="e.g., Holden Beach, NC"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={formData.latitude}
                onChangeText={(text) => setFormData({ ...formData, latitude: text })}
                placeholder="e.g., 33.9176"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={formData.longitude}
                onChangeText={(text) => setFormData({ ...formData, longitude: text })}
                placeholder="e.g., -78.3086"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>NOAA Buoy ID</Text>
              <Text style={styles.inputHint}>Find at: ndbc.noaa.gov (search for nearest buoy)</Text>
              <TextInput
                style={styles.input}
                value={formData.buoy_id}
                onChangeText={(text) => setFormData({ ...formData, buoy_id: text })}
                placeholder="e.g., 41013"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>NOAA Tide Station ID</Text>
              <Text style={styles.inputHint}>Find at: tidesandcurrents.noaa.gov (search for nearest station)</Text>
              <TextInput
                style={styles.input}
                value={formData.tide_station_id}
                onChangeText={(text) => setFormData({ ...formData, tide_station_id: text })}
                placeholder="e.g., 8658163"
                placeholderTextColor={colors.textSecondary}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeModal}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveLocation}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
