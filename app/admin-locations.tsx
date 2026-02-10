
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
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

export default function AdminLocationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { refreshLocations } = useLocation();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);

  // Form state
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');
  const [formBuoyId, setFormBuoyId] = useState('');
  const [formTideStationId, setFormTideStationId] = useState('');

  useEffect(() => {
    if (profile && !profile.is_admin) {
      console.log('[AdminLocationsScreen] User is not admin, redirecting...');
      Alert.alert('Access Denied', 'You do not have admin privileges');
      router.back();
    } else {
      loadLocations();
    }
  }, [profile]);

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      console.log('[AdminLocationsScreen] Loading locations...');

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) {
        console.error('[AdminLocationsScreen] Error loading locations:', error);
        throw error;
      }

      console.log('[AdminLocationsScreen] Loaded', data?.length || 0, 'locations');
      setLocations(data || []);
    } catch (error: any) {
      console.error('[AdminLocationsScreen] Error loading locations:', error);
      Alert.alert('Error', `Failed to load locations: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormId('');
    setFormName('');
    setFormDisplayName('');
    setFormLatitude('');
    setFormLongitude('');
    setFormBuoyId('');
    setFormTideStationId('');
    setEditingLocation(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (location: LocationItem) => {
    setFormId(location.id);
    setFormName(location.name);
    setFormDisplayName(location.display_name);
    setFormLatitude(location.latitude.toString());
    setFormLongitude(location.longitude.toString());
    setFormBuoyId(location.buoy_id);
    setFormTideStationId(location.tide_station_id);
    setEditingLocation(location);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!formId.trim()) {
      Alert.alert('Validation Error', 'Location ID is required (e.g., "myrtle-beach")');
      return false;
    }

    if (!formName.trim()) {
      Alert.alert('Validation Error', 'Location name is required');
      return false;
    }

    if (!formDisplayName.trim()) {
      Alert.alert('Validation Error', 'Display name is required');
      return false;
    }

    const lat = parseFloat(formLatitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Validation Error', 'Latitude must be between -90 and 90');
      return false;
    }

    const lon = parseFloat(formLongitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      Alert.alert('Validation Error', 'Longitude must be between -180 and 180');
      return false;
    }

    if (!formBuoyId.trim()) {
      Alert.alert('Validation Error', 'NOAA Buoy ID is required');
      return false;
    }

    if (!formTideStationId.trim()) {
      Alert.alert('Validation Error', 'NOAA Tide Station ID is required');
      return false;
    }

    return true;
  };

  const handleSaveLocation = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      console.log('[AdminLocationsScreen] Saving location...');

      const locationData = {
        id: formId.trim().toLowerCase().replace(/\s+/g, '-'),
        name: formName.trim(),
        display_name: formDisplayName.trim(),
        latitude: parseFloat(formLatitude),
        longitude: parseFloat(formLongitude),
        buoy_id: formBuoyId.trim(),
        tide_station_id: formTideStationId.trim(),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', editingLocation.id);

        if (error) {
          console.error('[AdminLocationsScreen] Error updating location:', error);
          throw error;
        }

        console.log('[AdminLocationsScreen] Location updated successfully');
        Alert.alert('Success', 'Location updated successfully');
      } else {
        // Insert new location
        const { error } = await supabase
          .from('locations')
          .insert(locationData);

        if (error) {
          console.error('[AdminLocationsScreen] Error creating location:', error);
          throw error;
        }

        console.log('[AdminLocationsScreen] Location created successfully');
        Alert.alert('Success', 'Location created successfully! All existing features (reports, videos, data updates) will now work for this location automatically.');
      }

      // Refresh locations in context
      await refreshLocations();
      await loadLocations();
      closeModal();
    } catch (error: any) {
      console.error('[AdminLocationsScreen] Error saving location:', error);
      Alert.alert('Error', `Failed to save location: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (location: LocationItem) => {
    try {
      console.log('[AdminLocationsScreen] Toggling active status for:', location.name);

      const { error } = await supabase
        .from('locations')
        .update({
          is_active: !location.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', location.id);

      if (error) {
        console.error('[AdminLocationsScreen] Error toggling status:', error);
        throw error;
      }

      console.log('[AdminLocationsScreen] Status toggled successfully');
      Alert.alert('Success', `Location ${!location.is_active ? 'activated' : 'deactivated'} successfully`);
      
      await refreshLocations();
      await loadLocations();
    } catch (error: any) {
      console.error('[AdminLocationsScreen] Error toggling status:', error);
      Alert.alert('Error', `Failed to update location: ${error.message}`);
    }
  };

  const handleDeleteLocation = (location: LocationItem) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.display_name}"? This will not delete associated data (reports, videos, etc.), but the location will no longer be selectable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[AdminLocationsScreen] Deleting location:', location.name);

              const { error } = await supabase
                .from('locations')
                .delete()
                .eq('id', location.id);

              if (error) {
                console.error('[AdminLocationsScreen] Error deleting location:', error);
                throw error;
              }

              console.log('[AdminLocationsScreen] Location deleted successfully');
              Alert.alert('Success', 'Location deleted successfully');
              
              await refreshLocations();
              await loadLocations();
            } catch (error: any) {
              console.error('[AdminLocationsScreen] Error deleting location:', error);
              Alert.alert('Error', `Failed to delete location: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const handleGoBack = () => {
    console.log('[AdminLocationsScreen] Navigating back...');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin');
    }
  };

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'arrow_back';
  const backButtonTextContent = 'Back';
  const headerTitleText = 'Manage Locations';
  const addButtonText = 'Add New Location';
  const modalTitleAdd = 'Add New Location';
  const modalTitleEdit = 'Edit Location';
  const saveButtonText = 'Save Location';
  const cancelButtonText = 'Cancel';

  if (!profile?.is_admin) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
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
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🌍 Dynamic Location Management</Text>
          <Text style={styles.infoText}>
            Add new surf locations and all existing features will automatically work for them:
            {'\n'}• Daily 5 AM reports
            {'\n'}• 15-minute buoy updates
            {'\n'}• Video uploads
            {'\n'}• Weather & tide data
            {'\n'}• Surf forecasts
            {'\n\n'}Simply add the location details and everything is set up automatically!
          </Text>
        </View>

        {/* Add Button */}
        <TouchableOpacity
          style={[styles.button, styles.addButton]}
          onPress={openAddModal}
          disabled={isLoading}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add_circle"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>{addButtonText}</Text>
        </TouchableOpacity>

        {/* Locations List */}
        {isLoading && locations.length === 0 ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <React.Fragment>
            {locations.map((location) => {
              const statusText = location.is_active ? 'Active' : 'Inactive';
              const statusColor = location.is_active ? colors.accent : colors.textSecondary;
              
              return (
                <View key={location.id} style={styles.locationCard}>
                  <View style={styles.locationHeader}>
                    <View style={styles.locationTitleRow}>
                      <Text style={styles.locationName}>{location.display_name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusText}>{statusText}</Text>
                      </View>
                    </View>
                    <Text style={styles.locationId}>ID: {location.id}</Text>
                  </View>

                  <View style={styles.locationDetails}>
                    <Text style={styles.detailText}>📍 Coordinates: {location.latitude}, {location.longitude}</Text>
                    <Text style={styles.detailText}>🌊 Buoy ID: {location.buoy_id}</Text>
                    <Text style={styles.detailText}>🌙 Tide Station: {location.tide_station_id}</Text>
                  </View>

                  <View style={styles.locationActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => openEditModal(location)}
                    >
                      <IconSymbol
                        ios_icon_name="pencil"
                        android_material_icon_name="edit"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, location.is_active ? styles.deactivateButton : styles.activateButton]}
                      onPress={() => handleToggleActive(location)}
                    >
                      <IconSymbol
                        ios_icon_name={location.is_active ? 'eye.slash' : 'eye'}
                        android_material_icon_name={location.is_active ? 'visibility_off' : 'visibility'}
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.actionButtonText}>
                        {location.is_active ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteLocation(location)}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </React.Fragment>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {editingLocation ? modalTitleEdit : modalTitleAdd}
              </Text>

              <Text style={styles.label}>Location ID (URL-friendly, e.g., "myrtle-beach")</Text>
              <TextInput
                style={styles.input}
                placeholder="myrtle-beach"
                value={formId}
                onChangeText={setFormId}
                editable={!editingLocation}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Location Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Myrtle Beach"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Myrtle Beach, SC"
                value={formDisplayName}
                onChangeText={setFormDisplayName}
              />

              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="33.6891"
                value={formLatitude}
                onChangeText={setFormLatitude}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="-78.8867"
                value={formLongitude}
                onChangeText={setFormLongitude}
                keyboardType="numeric"
              />

              <Text style={styles.label}>NOAA Buoy ID</Text>
              <TextInput
                style={styles.input}
                placeholder="41004"
                value={formBuoyId}
                onChangeText={setFormBuoyId}
              />

              <Text style={styles.label}>NOAA Tide Station ID</Text>
              <TextInput
                style={styles.input}
                placeholder="8661070"
                value={formTideStationId}
                onChangeText={setFormTideStationId}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={closeModal}
                >
                  <Text style={styles.buttonText}>{cancelButtonText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSaveLocation}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>{saveButtonText}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  locationId: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  locationDetails: {
    marginBottom: 12,
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
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
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  activateButton: {
    backgroundColor: '#10B981',
  },
  deactivateButton: {
    backgroundColor: '#F59E0B',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
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
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});
