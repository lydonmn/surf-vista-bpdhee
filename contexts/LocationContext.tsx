
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/app/integrations/supabase/client';

export type Location = string;

interface LocationData {
  id: string;
  name: string;
  displayName: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  buoyId: string;
  tideStationId: string;
}

interface LocationContextType {
  currentLocation: Location;
  locationData: LocationData;
  locations: LocationData[];
  setLocation: (location: Location) => Promise<void>;
  isLoading: boolean;
  refreshLocations: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = '@surfvista_location';

// Default fallback locations (in case database is unavailable)
const DEFAULT_LOCATIONS: LocationData[] = [
  {
    id: 'folly-beach',
    name: 'Folly Beach',
    displayName: 'Folly Beach, SC',
    coordinates: {
      lat: 32.6552,
      lon: -79.9403
    },
    buoyId: '41004',
    tideStationId: '8665530'
  },
  {
    id: 'pawleys-island',
    name: 'Pawleys Island',
    displayName: 'Pawleys Island, SC',
    coordinates: {
      lat: 33.4318,
      lon: -79.1192
    },
    buoyId: '41004',
    tideStationId: '8662245'
  }
];

export function LocationProvider({ children }: { children: ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<Location>('folly-beach');
  const [locations, setLocations] = useState<LocationData[]>(DEFAULT_LOCATIONS);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch locations from database
  const fetchLocations = useCallback(async () => {
    try {
      console.log('[LocationContext] Fetching locations from database...');
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('[LocationContext] Error fetching locations:', error);
        // Use default locations on error
        return;
      }

      if (data && data.length > 0) {
        const formattedLocations: LocationData[] = data.map(loc => ({
          id: loc.id,
          name: loc.name,
          displayName: loc.display_name,
          coordinates: {
            lat: parseFloat(loc.latitude),
            lon: parseFloat(loc.longitude)
          },
          buoyId: loc.buoy_id,
          tideStationId: loc.tide_station_id
        }));

        console.log('[LocationContext] Loaded', formattedLocations.length, 'locations');
        setLocations(formattedLocations);
      }
    } catch (error) {
      console.error('[LocationContext] Exception fetching locations:', error);
      // Keep using default locations
    }
  }, []);

  // Load saved location and fetch locations on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Fetch locations from database
        await fetchLocations();

        // Load saved location preference
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          console.log('[LocationContext] Loaded saved location:', saved);
          setCurrentLocation(saved);
        }
      } catch (error) {
        console.error('[LocationContext] Error initializing:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [fetchLocations]);

  const setLocation = useCallback(async (location: Location) => {
    try {
      console.log('[LocationContext] Setting location to:', location);
      setCurrentLocation(location);
      await AsyncStorage.setItem(STORAGE_KEY, location);
    } catch (error) {
      console.error('[LocationContext] Error saving location:', error);
    }
  }, []);

  const refreshLocations = useCallback(async () => {
    console.log('[LocationContext] Refreshing locations...');
    await fetchLocations();
  }, [fetchLocations]);

  // Get current location data
  const locationData = locations.find(loc => loc.id === currentLocation) || locations[0];

  const value: LocationContextType = {
    currentLocation,
    locationData,
    locations,
    setLocation,
    isLoading,
    refreshLocations
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

// Export for backward compatibility
export const LOCATIONS: Record<string, LocationData> = DEFAULT_LOCATIONS.reduce((acc, loc) => {
  acc[loc.id] = loc;
  return acc;
}, {} as Record<string, LocationData>);
