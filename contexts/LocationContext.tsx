
import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
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

const DEFAULT_LOCATIONS: LocationData[] = [
  {
    id: 'folly-beach',
    name: 'Folly Beach',
    displayName: 'Folly Beach, SC',
    coordinates: { lat: 32.6552, lon: -79.9403 },
    buoyId: '41004',
    tideStationId: '8665530'
  },
  {
    id: 'pawleys-island',
    name: 'Pawleys Island',
    displayName: 'Pawleys Island, SC',
    coordinates: { lat: 33.4318, lon: -79.1192 },
    buoyId: '41004',
    tideStationId: '8662245'
  },
  {
    id: 'holden-beach-nc',
    name: 'Holden Beach',
    displayName: 'Holden Beach, NC',
    coordinates: { lat: 33.9140, lon: -78.3070 },
    buoyId: '41013',
    tideStationId: '8659414'
  }
];

export function LocationProvider({ children }: { children: ReactNode }) {
  console.log('[LocationProvider] Mounting');
  
  // 🚨 CRITICAL FIX: Initialize with defaults immediately - no blocking
  const [currentLocation, setCurrentLocation] = useState<Location>('folly-beach');
  const [locations, setLocations] = useState<LocationData[]>(DEFAULT_LOCATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  const fetchLocations = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      console.log('[LocationContext] Fetching locations');
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!mountedRef.current) return;

      if (error) {
        console.error('[LocationContext] Error:', error);
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

        if (mountedRef.current) {
          console.log('[LocationContext] Loaded', formattedLocations.length, 'locations');
          setLocations(formattedLocations);
        }
      }
    } catch (err) {
      console.error('[LocationContext] Exception:', err);
    }
  }, []);

  // 🚨 CRITICAL FIX: Simplified initialization - no blocking, no race conditions
  useEffect(() => {
    console.log('[LocationContext] Starting initialization');

    // Load locations and saved preference in background (non-blocking)
    const initialize = async () => {
      try {
        // Fetch locations from database
        await fetchLocations();
        
        if (!mountedRef.current) return;

        // Load saved location preference
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        
        if (!mountedRef.current) return;

        if (saved) {
          console.log('[LocationContext] Loaded saved location:', saved);
          setCurrentLocation(saved);
        }
        
        console.log('[LocationContext] Init complete');
      } catch (err) {
        console.error('[LocationContext] Init error:', err);
        // Continue with defaults - don't block app
      }
    };

    // Start initialization after a brief delay to let UI render
    const delayedInit = setTimeout(() => {
      if (mountedRef.current) {
        initialize();
      }
    }, 250);

    return () => {
      console.log('[LocationContext] Cleanup');
      mountedRef.current = false;
      clearTimeout(delayedInit);
    };
  }, [fetchLocations]);

  const setLocation = useCallback(async (location: Location) => {
    try {
      console.log('[LocationContext] Setting location:', location);
      setCurrentLocation(location);
      await AsyncStorage.setItem(STORAGE_KEY, location);
    } catch (err) {
      console.error('[LocationContext] Save error:', err);
    }
  }, []);

  const refreshLocations = useCallback(async () => {
    console.log('[LocationContext] Refreshing locations');
    await fetchLocations();
  }, [fetchLocations]);

  const locationData = locations.find(loc => loc.id === currentLocation) || locations[0] || DEFAULT_LOCATIONS[0];

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

export const LOCATIONS: Record<string, LocationData> = DEFAULT_LOCATIONS.reduce((acc, loc) => {
  acc[loc.id] = loc;
  return acc;
}, {} as Record<string, LocationData>);
