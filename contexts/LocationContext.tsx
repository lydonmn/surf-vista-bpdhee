
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
  
  const [currentLocation, setCurrentLocation] = useState<Location>('folly-beach');
  const [locations, setLocations] = useState<LocationData[]>(DEFAULT_LOCATIONS);
  // 🚨 CRITICAL: Start ready immediately
  const [isLoading] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
      console.log('[LocationContext] Fetching locations');
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

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

        console.log('[LocationContext] Loaded', formattedLocations.length, 'locations');
        setLocations(formattedLocations);
      }
    } catch (err) {
      console.error('[LocationContext] Exception:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initialize = async () => {
      try {
        console.log('[LocationContext] Starting init');
        
        // 🚨 CRITICAL: Timeout protection
        const initPromise = (async () => {
          await fetchLocations();
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          return saved;
        })();

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Location init timeout')), 3000);
        });

        const saved = await Promise.race([initPromise, timeoutPromise]) as string | null;
        
        clearTimeout(timeoutId);

        if (!mounted) return;

        if (saved) {
          console.log('[LocationContext] Loaded saved location:', saved);
          setCurrentLocation(saved);
        }
        
        console.log('[LocationContext] Init complete');
      } catch (err) {
        console.error('[LocationContext] Init error:', err);
        // Continue with defaults - don't block app
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Delay initialization slightly to let native modules settle
    const delayedInit = setTimeout(() => {
      initialize();
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(delayedInit);
      clearTimeout(timeoutId);
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
