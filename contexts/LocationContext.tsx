
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Location = 'folly-beach' | 'pawleys-island';

interface LocationData {
  id: Location;
  name: string;
  displayName: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

export const LOCATIONS: Record<Location, LocationData> = {
  'folly-beach': {
    id: 'folly-beach',
    name: 'Folly Beach',
    displayName: 'Folly Beach, SC',
    coordinates: {
      lat: 32.6552,
      lon: -79.9403
    }
  },
  'pawleys-island': {
    id: 'pawleys-island',
    name: 'Pawleys Island',
    displayName: 'Pawleys Island, SC',
    coordinates: {
      lat: 33.4318,
      lon: -79.1192
    }
  }
};

interface LocationContextType {
  currentLocation: Location;
  locationData: LocationData;
  setLocation: (location: Location) => Promise<void>;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = '@surfvista_location';

export function LocationProvider({ children }: { children: ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<Location>('folly-beach');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved location on mount
  React.useEffect(() => {
    const loadLocation = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'folly-beach' || saved === 'pawleys-island')) {
          console.log('[LocationContext] Loaded saved location:', saved);
          setCurrentLocation(saved as Location);
        }
      } catch (error) {
        console.error('[LocationContext] Error loading location:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocation();
  }, []);

  const setLocation = useCallback(async (location: Location) => {
    try {
      console.log('[LocationContext] Setting location to:', location);
      setCurrentLocation(location);
      await AsyncStorage.setItem(STORAGE_KEY, location);
    } catch (error) {
      console.error('[LocationContext] Error saving location:', error);
    }
  }, []);

  const locationData = LOCATIONS[currentLocation];

  const value: LocationContextType = {
    currentLocation,
    locationData,
    setLocation,
    isLoading
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
