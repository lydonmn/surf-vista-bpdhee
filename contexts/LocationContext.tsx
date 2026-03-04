
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
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

// ✅ CRITICAL: Updated DEFAULT_LOCATIONS to include all existing locations as fallback
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
  },
  {
    id: 'holden-beach-nc',
    name: 'Holden Beach',
    displayName: 'Holden Beach, NC',
    coordinates: {
      lat: 33.9140,
      lon: -78.3070
    },
    buoyId: '41013',
    tideStationId: '8659414'
  }
];

export function LocationProvider({ children }: { children: ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<Location>('folly-beach');
  const [locations, setLocations] = useState<LocationData[]>(DEFAULT_LOCATIONS);
  const [isLoading, setIsLoading] = useState(true);

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
        console.log('[LocationContext] Using DEFAULT_LOCATIONS as fallback');
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

        console.log('[LocationContext] ✅ Loaded', formattedLocations.length, 'active locations from database');
        setLocations(formattedLocations);
      } else {
        console.log('[LocationContext] No active locations in database, using DEFAULT_LOCATIONS');
      }
    } catch (error) {
      console.error('[LocationContext] Exception fetching locations:', error);
      console.log('[LocationContext] Using DEFAULT_LOCATIONS as fallback');
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[LocationContext] Initializing...');
        
        // Set a timeout to ensure we don't hang on startup
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => {
            console.warn('[LocationContext] Initialization timeout - using defaults');
            resolve(null);
          }, 5000)
        );

        const initPromise = (async () => {
          // Fetch locations from database first
          await fetchLocations();

          // Load saved location preference
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            console.log('[LocationContext] Loaded saved location preference:', saved);
            setCurrentLocation(saved);
          } else {
            console.log('[LocationContext] No saved location, using default: folly-beach');
          }
        })();

        await Promise.race([initPromise, timeoutPromise]);
        
      } catch (error) {
        console.error('[LocationContext] Error initializing (non-critical):', error);
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
    console.log('[LocationContext] ⚡ Refreshing locations from database...');
    await fetchLocations();
  }, [fetchLocations]);

  // ✅ CRITICAL: Ensure locationData always has a valid location, even if currentLocation is not in the list
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

// ✅ Export LOCATIONS for backward compatibility
export const LOCATIONS: Record<string, LocationData> = DEFAULT_LOCATIONS.reduce((acc, loc) => {
  acc[loc.id] = loc;
  return acc;
}, {} as Record<string, LocationData>);
