
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useLocation, LOCATIONS, Location } from '@/contexts/LocationContext';

export function LocationSelector() {
  const theme = useTheme();
  const { currentLocation, locationData, setLocation } = useLocation();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleLocationSelect = async (location: Location) => {
    console.log('[LocationSelector] User selected location:', location);
    await setLocation(location);
    setIsModalVisible(false);
  };

  const locationDisplayText = locationData.name;

  return (
    <>
      <TouchableOpacity
        style={[styles.locationButton, { backgroundColor: theme.colors.card }]}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.7}
      >
        <IconSymbol
          ios_icon_name="location.fill"
          android_material_icon_name="location-on"
          size={16}
          color={colors.primary}
        />
        <Text style={[styles.locationText, { color: theme.colors.text }]}>
          {locationDisplayText}
        </Text>
        <IconSymbol
          ios_icon_name="chevron.down"
          android_material_icon_name="arrow-drop-down"
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Select Location
              </Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
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

            {Object.values(LOCATIONS).map((location) => {
              const isSelected = location.id === currentLocation;
              
              return (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationOption,
                    { backgroundColor: theme.colors.background },
                    isSelected && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => handleLocationSelect(location.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.locationOptionContent}>
                    <IconSymbol
                      ios_icon_name="location.fill"
                      android_material_icon_name="location-on"
                      size={24}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.locationInfo}>
                      <Text style={[styles.locationName, { color: theme.colors.text }]}>
                        {location.name}
                      </Text>
                      <Text style={[styles.locationSubtext, { color: colors.textSecondary }]}>
                        {location.displayName}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  locationOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
});
