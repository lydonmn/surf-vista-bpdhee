
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
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
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

interface BuoyOption {
  id: string;
  name: string;
  distanceNm: number;
  latitude: number;
  longitude: number;
}

interface TideStation {
  id: string;
  name: string;
  distance: number;
}

interface LocationSearchResult {
  id: string;
  shortName: string;
  displayName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  buoyOptions: BuoyOption[];
  tideStation: TideStation;
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
  searchButton: {
    backgroundColor: '#10B981',
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
  },
  testLogMessage: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
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
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
  },
  featureCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 22,
  },
  featureBullet: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 22,
    marginLeft: 8,
  },
  searchSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchButtonSmall: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonTextSmall: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchResultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 12,
  },
  searchResultRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  searchResultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 100,
  },
  searchResultValue: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  buoyOptionsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  buoyOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 12,
  },
  buoyOptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  buoyOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  buoyOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  buoyOptionDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  confirmButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outputCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  outputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 12,
  },
  outputText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyButton: {
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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

  // New search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<LocationSearchResult | null>(null);
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  // Error modal state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (title: string, message: string) => {
    console.log('AdminLocationsScreen: Showing error:', title, message);
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const loadLocations = useCallback(async () => {
    console.log('AdminLocationsScreen: Loading locations');
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) {
        console.error('AdminLocationsScreen: Error loading locations:', error);
        showError('Error', `Failed to load locations: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: Loaded locations:', data);
      setLocations(data || []);
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error:', err);
      showError('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('AdminLocationsScreen: Component mounted, profile:', profile);
    if (profile) {
      loadLocations();
    }
  }, [profile, loadLocations]);

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
    setSearchQuery('');
    setSearchResult(null);
    setSelectedBuoyId(null);
    setShowOutput(false);
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
    setSearchResult(null);
    setSelectedBuoyId(null);
    setShowOutput(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    console.log('AdminLocationsScreen: Closing modal');
    setModalVisible(false);
    resetForm();
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) {
      showError('Validation Error', 'Please enter a location name to search');
      return;
    }

    console.log('AdminLocationsScreen: Searching for location:', searchQuery);
    setSearching(true);
    setSearchResult(null);
    setSelectedBuoyId(null);
    setShowOutput(false);

    try {
      const { data, error } = await supabase.functions.invoke('search-location-data', {
        body: { locationName: searchQuery },
      });

      if (error) {
        console.error('AdminLocationsScreen: Search error:', error);
        showError('Search Failed', error.message || 'Failed to search for location');
        return;
      }

      if (!data.success || !data.data) {
        console.error('AdminLocationsScreen: Search returned no results');
        showError('No Results', data.error || 'Could not find location. Please try a different search term.');
        return;
      }

      console.log('AdminLocationsScreen: Search successful:', data.data);
      const result = data.data as LocationSearchResult;
      
      setSearchResult(result);
      
      // Auto-populate form with search results
      setFormData({
        id: result.id,
        name: result.shortName,
        display_name: result.displayName,
        latitude: result.coordinates.lat.toString(),
        longitude: result.coordinates.lng.toString(),
        buoy_id: result.buoyOptions[0]?.id || '',
        tide_station_id: result.tideStation.id,
        is_active: true,
      });
      
      // Auto-select first buoy
      if (result.buoyOptions.length > 0) {
        setSelectedBuoyId(result.buoyOptions[0].id);
      }

    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected search error:', err);
      showError('Error', 'An unexpected error occurred while searching');
    } finally {
      setSearching(false);
    }
  };

  const handleBuoySelect = (buoyId: string) => {
    console.log('AdminLocationsScreen: Buoy selected:', buoyId);
    setSelectedBuoyId(buoyId);
    setFormData({ ...formData, buoy_id: buoyId });
    setShowOutput(false);
  };

  const handleConfirmSelection = () => {
    if (!searchResult || !selectedBuoyId) {
      showError('Selection Required', 'Please select a buoy before confirming');
      return;
    }

    console.log('AdminLocationsScreen: Confirming selection with buoy:', selectedBuoyId);
    setShowOutput(true);
  };

  const getOutputText = (): string => {
    if (!searchResult || !selectedBuoyId) return '';
    
    const selectedBuoy = searchResult.buoyOptions.find(b => b.id === selectedBuoyId);
    if (!selectedBuoy) return '';

    const buoyNameText = `${selectedBuoy.id} (${selectedBuoy.name})`;
    const coordsText = `${searchResult.coordinates.lat}, ${searchResult.coordinates.lng}`;
    
    return `• ID: ${searchResult.id}\n• Name: ${searchResult.shortName}\n• Display: ${searchResult.displayName}\n• Buoy: ${buoyNameText}\n• Tide Station: ${searchResult.tideStation.id}\n• Coordinates: ${coordsText}`;
  };

  const validateForm = (): boolean => {
    if (!formData.id.trim()) {
      showError('Validation Error', 'Location ID is required');
      return false;
    }
    if (!formData.name.trim()) {
      showError('Validation Error', 'Location Name is required');
      return false;
    }
    if (!formData.display_name.trim()) {
      showError('Validation Error', 'Display Name is required');
      return false;
    }
    if (!formData.latitude.trim() || isNaN(parseFloat(formData.latitude))) {
      showError('Validation Error', 'Valid Latitude is required');
      return false;
    }
    if (!formData.longitude.trim() || isNaN(parseFloat(formData.longitude))) {
      showError('Validation Error', 'Valid Longitude is required');
      return false;
    }
    if (!formData.buoy_id.trim()) {
      showError('Validation Error', 'NOAA Buoy ID is required');
      return false;
    }
    if (!formData.tide_station_id.trim()) {
      showError('Validation Error', 'NOAA Tide Station ID is required');
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
        showError('Error', `Failed to save location: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: ✅ Location saved successfully');
      
      // ✅ CRITICAL: Refresh the LocationContext so the new location appears everywhere
      await refreshLocations();
      
      const successMessage = `Location "${formData.display_name}" saved successfully!\n\n✅ Location will now appear in:\n  • Location selector\n  • Homepage video card\n  • Admin data manager\n  • All reports and forecasts\n\nNext steps:\n1. Click "Test Data" to verify NOAA sources\n2. Upload videos for this location\n3. Generate daily reports`;
      
      showError('Success!', successMessage);
      
      closeModal();
      await loadLocations();
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error saving location:', err);
      showError('Error', 'An unexpected error occurred');
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
        showError('Error', `Failed to update location: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: Active status toggled successfully');
      
      // ✅ CRITICAL: Refresh LocationContext when toggling active status
      await refreshLocations();
      await loadLocations();
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error toggling active:', err);
      showError('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const [testLog, setTestLog] = useState<ActivityLog[]>([]);
  
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[AdminLocationsScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setTestLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 20));
  }, []);

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
        showError(
          'Test Successful!',
          `All data sources are working correctly for ${location.display_name}:\n\n✅ Buoy ${location.buoy_id}\n✅ Weather (${location.latitude}, ${location.longitude})\n✅ Tide Station ${location.tide_station_id}\n\nThis location is ready to:\n  • Generate daily reports\n  • Display on homepage\n  • Show in location selector\n  • Accept video uploads`
        );
      } else {
        showError(
          'Test Results',
          `Some data sources may have issues for ${location.display_name}. Check the activity log for details.`
        );
      }
      
    } catch (err) {
      console.error('AdminLocationsScreen: Error testing location:', err);
      addLog(`❌ Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      showError('Error', 'Failed to test location data sources');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = (location: LocationItem) => {
    console.log('AdminLocationsScreen: Delete requested for:', location);
    
    // Use custom modal for confirmation
    showError(
      'Confirm Delete',
      `Are you sure you want to delete "${location.display_name}"? This action cannot be undone.`
    );
    
    // Note: Actual deletion would need a separate confirmation modal with action buttons
    // For now, keeping the Alert.alert for delete confirmation
    setTimeout(() => {
      setErrorModalVisible(false);
      
      // Show native alert for delete confirmation
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(`Are you sure you want to delete "${location.display_name}"? This action cannot be undone.`);
        if (confirmed) {
          performDelete(location);
        }
      } else {
        // On native, we can use Alert
        const Alert = require('react-native').Alert;
        Alert.alert(
          'Confirm Delete',
          `Are you sure you want to delete "${location.display_name}"? This action cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => performDelete(location),
            },
          ]
        );
      }
    }, 100);
  };

  const performDelete = async (location: LocationItem) => {
    console.log('AdminLocationsScreen: Deleting location:', location);
    try {
      setLoading(true);
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id);

      if (error) {
        console.error('AdminLocationsScreen: Error deleting location:', error);
        showError('Error', `Failed to delete location: ${error.message}`);
        return;
      }

      console.log('AdminLocationsScreen: Location deleted successfully');
      
      // ✅ CRITICAL: Refresh LocationContext when deleting
      await refreshLocations();
      
      showError('Success', 'Location deleted successfully!');
      await loadLocations();
    } catch (err) {
      console.error('AdminLocationsScreen: Unexpected error deleting:', err);
      showError('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

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

        {/* ✅ NEW: What Happens When You Add a Location */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>✨ What Happens When You Add a Location</Text>
          <Text style={styles.featureText}>
            When you add a new location, it will automatically:
          </Text>
          <Text style={styles.featureBullet}>
            • Appear in the location selector dropdown
          </Text>
          <Text style={styles.featureBullet}>
            • Show its own homepage video card (latest video for that location)
          </Text>
          <Text style={styles.featureBullet}>
            • Display location-specific surf reports and forecasts
          </Text>
          <Text style={styles.featureBullet}>
            • Accept video uploads tagged to that location
          </Text>
          <Text style={styles.featureBullet}>
            • Generate daily 5 AM reports with NOAA data
          </Text>
          <Text style={styles.featureBullet}>
            • Send push notifications to subscribers
          </Text>
          <Text style={styles.featureText}>
            The system is fully dynamic - no code changes needed!
          </Text>
        </View>

        {/* Help Guide */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>📚 How to Add a New Location</Text>
          <Text style={styles.helpText}>
            NEW: Just type the beach name and click "Search"!{'\n'}
            The system will automatically find:{'\n'}
            • Coordinates from Google Maps{'\n'}
            • 3-5 nearest NOAA buoys{'\n'}
            • Nearest tide station{'\n'}
            • Generate location ID and names{'\n\n'}
            Then:{'\n'}
            1. Select the best buoy from the list{'\n'}
            2. Review the data{'\n'}
            3. Click "Save Location"{'\n'}
            4. Test the data sources{'\n'}
            5. Start uploading videos!
          </Text>
          <Text style={styles.helpExample}>
            Example searches:{'\n'}
            • "Jupiter Inlet Florida"{'\n'}
            • "Myrtle Beach SC"{'\n'}
            • "Holden Beach North Carolina"{'\n'}
            • "Nantucket Cisco Beach"
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

      {/* Add/Edit Location Modal */}
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
              {/* Search Section - Only show when adding new location */}
              {!editingLocation && (
                <View style={styles.searchSection}>
                  <Text style={styles.searchTitle}>🔍 Smart Location Search</Text>
                  <Text style={styles.helpText}>
                    Type a beach or surf spot name and we'll automatically find all the data you need!
                  </Text>
                  
                  <View style={styles.searchInputContainer}>
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="e.g., Jupiter Inlet Florida"
                      placeholderTextColor="#9CA3AF"
                      editable={!searching}
                    />
                    <TouchableOpacity
                      style={styles.searchButtonSmall}
                      onPress={handleSearchLocation}
                      disabled={searching}
                    >
                      {searching ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.searchButtonTextSmall}>Search</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Search Results */}
                  {searchResult && (
                    <View style={styles.searchResultCard}>
                      <Text style={styles.searchResultTitle}>📍 Location Found!</Text>
                      
                      <View style={styles.searchResultRow}>
                        <Text style={styles.searchResultLabel}>ID:</Text>
                        <Text style={styles.searchResultValue}>{searchResult.id}</Text>
                      </View>
                      
                      <View style={styles.searchResultRow}>
                        <Text style={styles.searchResultLabel}>Name:</Text>
                        <Text style={styles.searchResultValue}>{searchResult.shortName}</Text>
                      </View>
                      
                      <View style={styles.searchResultRow}>
                        <Text style={styles.searchResultLabel}>Display:</Text>
                        <Text style={styles.searchResultValue}>{searchResult.displayName}</Text>
                      </View>
                      
                      <View style={styles.searchResultRow}>
                        <Text style={styles.searchResultLabel}>Coordinates:</Text>
                        <Text style={styles.searchResultValue}>
                          {searchResult.coordinates.lat.toFixed(4)}, {searchResult.coordinates.lng.toFixed(4)}
                        </Text>
                      </View>
                      
                      <View style={styles.searchResultRow}>
                        <Text style={styles.searchResultLabel}>Tide Station:</Text>
                        <Text style={styles.searchResultValue}>
                          {searchResult.tideStation.id} ({searchResult.tideStation.distance.toFixed(1)} nm)
                        </Text>
                      </View>

                      {/* Buoy Selection */}
                      <View style={styles.buoyOptionsSection}>
                        <Text style={styles.buoyOptionsTitle}>
                          🌊 Select NOAA Buoy ({searchResult.buoyOptions.length} options)
                        </Text>
                        <Text style={styles.helpText}>
                          Choose the buoy that best represents surf conditions for this location:
                        </Text>
                        
                        {searchResult.buoyOptions.map((buoy) => {
                          const isSelected = selectedBuoyId === buoy.id;
                          const buoyNameText = buoy.name;
                          const buoyIdText = buoy.id;
                          const distanceText = `${buoy.distanceNm} nm away`;
                          
                          return (
                            <TouchableOpacity
                              key={buoy.id}
                              style={[
                                styles.buoyOptionCard,
                                isSelected && styles.buoyOptionSelected,
                              ]}
                              onPress={() => handleBuoySelect(buoy.id)}
                            >
                              <Text style={styles.buoyOptionName}>
                                {buoyIdText} - {buoyNameText}
                              </Text>
                              <Text style={styles.buoyOptionDetails}>
                                {distanceText}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        
                        <TouchableOpacity
                          style={[
                            styles.confirmButton,
                            !selectedBuoyId && styles.confirmButtonDisabled,
                          ]}
                          onPress={handleConfirmSelection}
                          disabled={!selectedBuoyId}
                        >
                          <Text style={styles.confirmButtonText}>
                            ✓ Confirm Buoy Selection
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Output Block */}
                      {showOutput && selectedBuoyId && (
                        <View style={styles.outputCard}>
                          <Text style={styles.outputTitle}>
                            📋 Ready-to-Copy Data Block
                          </Text>
                          <Text style={styles.outputText}>
                            {getOutputText()}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Manual Entry Fields */}
              <Text style={styles.inputLabel}>Location ID (URL-friendly, e.g., "myrtle-beach")</Text>
              <TextInput
                style={styles.input}
                value={formData.id}
                onChangeText={(text) =>
                  setFormData({ ...formData, id: text.toLowerCase().replace(/\s+/g, '-') })
                }
                placeholder="e.g., holden-beach-nc"
                placeholderTextColor={colors.textSecondary}
                editable={!editingLocation && !searchResult}
              />

              <Text style={styles.inputLabel}>Location Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Holden Beach"
                placeholderTextColor={colors.textSecondary}
                editable={!searchResult}
              />

              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={formData.display_name}
                onChangeText={(text) => setFormData({ ...formData, display_name: text })}
                placeholder="e.g., Holden Beach, NC"
                placeholderTextColor={colors.textSecondary}
                editable={!searchResult}
              />

              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={formData.latitude}
                onChangeText={(text) => setFormData({ ...formData, latitude: text })}
                placeholder="e.g., 33.9140"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                editable={!searchResult}
              />

              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={formData.longitude}
                onChangeText={(text) => setFormData({ ...formData, longitude: text })}
                placeholder="e.g., -78.3070"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                editable={!searchResult}
              />

              <Text style={styles.inputLabel}>NOAA Buoy ID</Text>
              {!searchResult && (
                <Text style={styles.inputHint}>Find at: ndbc.noaa.gov (search for nearest buoy)</Text>
              )}
              <TextInput
                style={styles.input}
                value={formData.buoy_id}
                onChangeText={(text) => setFormData({ ...formData, buoy_id: text })}
                placeholder="e.g., 41013"
                placeholderTextColor={colors.textSecondary}
                editable={!searchResult}
              />

              <Text style={styles.inputLabel}>NOAA Tide Station ID</Text>
              {!searchResult && (
                <Text style={styles.inputHint}>Find at: tidesandcurrents.noaa.gov (search for nearest station)</Text>
              )}
              <TextInput
                style={styles.input}
                value={formData.tide_station_id}
                onChangeText={(text) => setFormData({ ...formData, tide_station_id: text })}
                placeholder="e.g., 8659414"
                placeholderTextColor={colors.textSecondary}
                editable={!searchResult}
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
                <Text style={styles.modalButtonText}>Save Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
