
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useLocation } from '@/contexts/LocationContext';

interface NotificationLocationSelectorProps {
  selectedLocations: string[];
  onLocationsChange: (locations: string[]) => void;
  disabled?: boolean;
}

export function NotificationLocationSelector({ 
  selectedLocations, 
  onLocationsChange,
  disabled = false 
}: NotificationLocationSelectorProps) {
  const theme = useTheme();
  const { locations } = useLocation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tempSelectedLocations, setTempSelectedLocations] = useState<string[]>(selectedLocations);

  useEffect(() => {
    setTempSelectedLocations(selectedLocations);
  }, [selectedLocations]);

  const handleToggleLocation = (locationId: string) => {
    console.log('[NotificationLocationSelector] Toggling location:', locationId);
    
    setTempSelectedLocations(prev => {
      const newSelection = prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId];
      
      console.log('[NotificationLocationSelector] New selection:', newSelection);
      return newSelection;
    });
  };

  const handleSave = () => {
    console.log('[NotificationLocationSelector] Saving locations:', tempSelectedLocations);
    
    if (tempSelectedLocations.length === 0) {
      // Don't allow empty selection - keep at least one location
      console.log('[NotificationLocationSelector] Cannot save empty selection');
      return;
    }
    
    onLocationsChange(tempSelectedLocations);
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    console.log('[NotificationLocationSelector] Cancelled - reverting to:', selectedLocations);
    setTempSelectedLocations(selectedLocations);
    setIsModalVisible(false);
  };

  const selectedLocationNames = locations
    .filter(loc => selectedLocations.includes(loc.id))
    .map(loc => loc.name)
    .join(', ');

  const displayText = selectedLocations.length === 0 
    ? 'No locations selected'
    : selectedLocations.length === locations.length
      ? 'All locations'
      : selectedLocationNames;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selectorButton, 
          { 
            backgroundColor: theme.colors.background,
            borderColor: colors.primary 
          },
          disabled && styles.selectorButtonDisabled
        ]}
        onPress={() => !disabled && setIsModalVisible(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <IconSymbol
            ios_icon_name="location.fill"
            android_material_icon_name="location_on"
            size={20}
            color={disabled ? colors.textSecondary : colors.primary}
          />
          <View style={styles.selectorTextContainer}>
            <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
              Report Locations
            </Text>
            <Text 
              style={[
                styles.selectorValue, 
                { color: disabled ? colors.textSecondary : theme.colors.text }
              ]}
              numberOfLines={1}
            >
              {displayText}
            </Text>
          </View>
        </View>
        {!disabled && (
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron_right"
            size={20}
            color={colors.textSecondary}
          />
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Select Report Locations
              </Text>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.closeButton}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Choose which locations you want to receive daily surf reports for at 5 AM EST.
            </Text>

            <ScrollView style={styles.locationsList}>
              {locations.map((location) => {
                const isSelected = tempSelectedLocations.includes(location.id);
                
                return (
                  <TouchableOpacity
                    key={location.id}
                    style={[
                      styles.locationOption,
                      { backgroundColor: theme.colors.background },
                      isSelected && { 
                        backgroundColor: colors.primary + '20',
                        borderColor: colors.primary,
                        borderWidth: 2
                      }
                    ]}
                    onPress={() => handleToggleLocation(location.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.locationOptionContent}>
                      <View style={[
                        styles.checkbox,
                        { borderColor: isSelected ? colors.primary : colors.textSecondary },
                        isSelected && { backgroundColor: colors.primary }
                      ]}>
                        {isSelected && (
                          <IconSymbol
                            ios_icon_name="checkmark"
                            android_material_icon_name="check"
                            size={16}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <View style={styles.locationInfo}>
                        <Text style={[styles.locationName, { color: theme.colors.text }]}>
                          {location.name}
                        </Text>
                        <Text style={[styles.locationSubtext, { color: colors.textSecondary }]}>
                          {location.displayName}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={[styles.selectionCount, { color: colors.textSecondary }]}>
                {tempSelectedLocations.length} location{tempSelectedLocations.length !== 1 ? 's' : ''} selected
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={handleCancel}
                >
                  <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.modalSaveButton, 
                    { backgroundColor: colors.primary },
                    tempSelectedLocations.length === 0 && styles.modalButtonDisabled
                  ]}
                  onPress={handleSave}
                  disabled={tempSelectedLocations.length === 0}
                >
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  selectorButtonDisabled: {
    opacity: 0.5,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  selectorTextContainer: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    boxShadow: '0px -4px 12px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  locationsList: {
    maxHeight: 400,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  locationOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationSubtext: {
    fontSize: 13,
  },
  modalFooter: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectionCount: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalSaveButton: {
    // backgroundColor set inline
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
