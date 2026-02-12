
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';

type SurfReport = Database['public']['Tables']['surf_reports']['Row'];
type WeatherData = Database['public']['Tables']['weather_data']['Row'];
type WeatherForecast = Database['public']['Tables']['weather_forecast']['Row'];
type TideData = Database['public']['Tables']['tide_data']['Row'];

interface SurfDataState {
  surfReports: SurfReport[];
  weatherData: WeatherData | null;
  weatherForecast: WeatherForecast[];
  tideData: TideData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const REFRESH_INTERVAL = 30 * 60 * 1000; // ✅ CRITICAL FIX: Increased to 30 minutes to reduce reload frequency
const RETRY_DELAY = 5000; // 5 seconds
const FUNCTION_TIMEOUT = 60000; // 60 seconds

// Helper function to get EST date - FIXED to use toLocaleDateString
function getESTDate(): string {
  const now = new Date();
  
  // Get the date in EST timezone using toLocaleDateString (more reliable than toLocaleString)
  const estDateString = now.toLocaleDateString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the date string (format: "MM/DD/YYYY")
  const [month, day, year] = estDateString.split('/');
  
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

export function useSurfData() {
  const { currentLocation } = useLocation();
  const [state, setState] = useState<SurfDataState>({
    surfReports: [],
    weatherData: null,
    weatherForecast: [],
    tideData: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  const isUpdatingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  // ✅ CRITICAL FIX: Stable fetchData function with debouncing
  const fetchData = useCallback(async () => {
    // ✅ CRITICAL: Prevent concurrent fetches and debounce rapid calls
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    if (!isMountedRef.current || isFetchingRef.current) {
      console.log('[useSurfData] Fetch already in progress or component unmounted, skipping...');
      return;
    }

    // ✅ CRITICAL: Debounce - don't fetch if we just fetched within last 5 seconds
    if (timeSinceLastFetch < 5000) {
      console.log('[useSurfData] Fetch called too soon after last fetch (', timeSinceLastFetch, 'ms), skipping...');
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current date in EST
      const today = getESTDate();
      
      console.log('[useSurfData] Fetching data for location:', currentLocation);
      console.log('[useSurfData] Fetching data for EST date:', today);

      // Fetch all data in parallel with location filter
      const [surfReportsResult, weatherResult, forecastResult, tideResult] = await Promise.all([
        supabase
          .from('surf_reports')
          .select('*')
          .eq('location', currentLocation)
          .order('date', { ascending: false })
          .limit(7),
        supabase
          .from('weather_data')
          .select('*')
          .eq('location', currentLocation)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('weather_forecast')
          .select('*')
          .eq('location', currentLocation)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(7),
        supabase
          .from('tide_data')
          .select('*')
          .eq('location', currentLocation)
          .gte('date', today)
          .order('date', { ascending: true })
          .order('time', { ascending: true }),
      ]);

      if (!isMountedRef.current) {
        isFetchingRef.current = false;
        return;
      }

      if (surfReportsResult.error) {
        console.error('[useSurfData] Surf reports error:', surfReportsResult.error);
        throw surfReportsResult.error;
      }
      if (weatherResult.error) {
        console.error('[useSurfData] Weather error:', weatherResult.error);
        throw weatherResult.error;
      }
      if (forecastResult.error) {
        console.error('[useSurfData] Forecast error:', forecastResult.error);
        throw forecastResult.error;
      }
      if (tideResult.error) {
        console.error('[useSurfData] Tide error:', tideResult.error);
        throw tideResult.error;
      }

      console.log('[useSurfData] Data fetched successfully for location:', currentLocation);

      // Check if we have any data for this location
      const hasData = (surfReportsResult.data && surfReportsResult.data.length > 0) ||
                      weatherResult.data ||
                      (forecastResult.data && forecastResult.data.length > 0) ||
                      (tideResult.data && tideResult.data.length > 0);

      if (isMountedRef.current) {
        setState({
          surfReports: surfReportsResult.data || [],
          weatherData: weatherResult.data,
          weatherForecast: forecastResult.data || [],
          tideData: tideResult.data || [],
          isLoading: false,
          error: !hasData && currentLocation === 'pawleys-island' 
            ? 'Data for Pawleys Island is being set up. Please tap "Update Data" to fetch the latest conditions.' 
            : null,
          lastUpdated: new Date(),
        });
      }

      // Clear any pending retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('[useSurfData] Error fetching surf data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        // Retry after delay
        console.log('[useSurfData] Scheduling retry in 5 seconds...');
        retryTimeoutRef.current = setTimeout(() => {
          console.log('[useSurfData] Retrying data fetch...');
          isFetchingRef.current = false;
          lastFetchTimeRef.current = 0; // Reset debounce for retry
          fetchData();
        }, RETRY_DELAY);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [currentLocation]);

  const updateAllData = useCallback(async () => {
    if (!isMountedRef.current || isUpdatingRef.current) {
      console.log('[useSurfData] Update already in progress, skipping...');
      return;
    }

    try {
      isUpdatingRef.current = true;
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log('[useSurfData] Updating all data via Edge Functions for location:', currentLocation);

      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT);

      try {
        // Call the unified edge function with location parameter
        const response = await Promise.race([
          supabase.functions.invoke('update-all-surf-data', {
            body: { location: currentLocation },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout - please try again')), FUNCTION_TIMEOUT)
          )
        ]) as any;

        clearTimeout(timeoutId);

        console.log('[useSurfData] Update response:', { 
          data: response.data, 
          error: response.error,
        });

        // Check for HTTP errors first
        if (response.error) {
          console.error('[useSurfData] Update failed with error:', response.error);
          
          // Try to parse error message
          let errorMsg = 'Update failed';
          if (response.error.message) {
            errorMsg = response.error.message;
          } else if (typeof response.error === 'string') {
            errorMsg = response.error;
          }
          
          // Check if it's a network error
          if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network request failed')) {
            errorMsg = 'Network error - please check your internet connection and try again';
          }
          
          throw new Error(errorMsg);
        }

        // Check if the response data indicates failure
        if (response.data && !response.data.success) {
          console.error('[useSurfData] Update failed:', response.data.errors);
          
          // Build detailed error message
          const errorDetails = [];
          
          if (response.data.results) {
            if (response.data.results.weather && !response.data.results.weather.success) {
              errorDetails.push(`Weather: ${response.data.results.weather.error || 'Failed'}`);
            }
            if (response.data.results.tide && !response.data.results.tide.success) {
              errorDetails.push(`Tide: ${response.data.results.tide.error || 'Failed'}`);
            }
            if (response.data.results.surf && !response.data.results.surf.success) {
              errorDetails.push(`Surf: ${response.data.results.surf.error || 'Failed'}`);
            }
            if (response.data.results.report && !response.data.results.report.success) {
              errorDetails.push(`Report: ${response.data.results.report.error || 'Failed'}`);
            }
          }
          
          const errorMessage = errorDetails.length > 0 
            ? errorDetails.join(', ')
            : response.data.error || 'Update failed';
          
          throw new Error(errorMessage);
        }

        // ✅ CRITICAL FIX: Wait for database to update before refreshing
        console.log('[useSurfData] Waiting for database to update...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Refresh data from database
        console.log('[useSurfData] Refreshing data from database...');
        isFetchingRef.current = false;
        lastFetchTimeRef.current = 0; // Reset debounce for manual update
        await fetchData();
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      console.error('[useSurfData] Error updating surf data:', error);
      if (isMountedRef.current) {
        let errorMessage = 'Failed to update data';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Provide more user-friendly error messages
          if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network request failed')) {
            errorMessage = 'Network error - please check your internet connection';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = 'Request timed out - NOAA servers may be slow, please try again';
          } else if (errorMessage.includes('NOAA')) {
            errorMessage = 'NOAA data temporarily unavailable - please try again in a few minutes';
          }
        }
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        
        // Re-throw so the UI can show an alert
        throw new Error(errorMessage);
      }
    } finally {
      isUpdatingRef.current = false;
    }
  }, [fetchData, currentLocation]);

  // ✅ CRITICAL FIX: Stable periodic refresh setup with longer interval
  useEffect(() => {
    console.log('[useSurfData] Setting up periodic refresh (every 30 minutes)...');
    
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval
    refreshIntervalRef.current = setInterval(() => {
      console.log('[useSurfData] Periodic refresh triggered');
      if (!isFetchingRef.current) {
        fetchData();
      }
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchData]);

  // ✅ CRITICAL FIX: Stable app state change handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[useSurfData] App state changed:', appStateRef.current, '->', nextAppState);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[useSurfData] App came to foreground, refreshing data...');
        if (!isFetchingRef.current) {
          fetchData();
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
    };
  }, [fetchData]);

  // ✅ CRITICAL FIX: Fetch data when location changes (only once per location change)
  useEffect(() => {
    console.log('[useSurfData] Location changed to:', currentLocation);
    if (!isFetchingRef.current) {
      lastFetchTimeRef.current = 0; // Reset debounce for location change
      fetchData();
    }
  }, [currentLocation, fetchData]);

  // ✅ CRITICAL FIX: Set up real-time subscriptions separately (no dependencies on fetchData)
  useEffect(() => {
    console.log('[useSurfData] Setting up real-time subscriptions for location:', currentLocation);

    // Set up real-time subscription for surf reports
    const surfReportsSubscription = supabase
      .channel(`surf_reports_${currentLocation}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'surf_reports',
          filter: `location=eq.${currentLocation}`,
        },
        (payload) => {
          console.log('[useSurfData] Surf report updated for current location, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0; // Reset debounce for real-time update
            fetchData();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for weather data
    const weatherSubscription = supabase
      .channel(`weather_data_${currentLocation}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weather_data',
          filter: `location=eq.${currentLocation}`,
        },
        (payload) => {
          console.log('[useSurfData] Weather data updated for current location, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0; // Reset debounce for real-time update
            fetchData();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for weather forecast
    const forecastSubscription = supabase
      .channel(`weather_forecast_${currentLocation}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weather_forecast',
          filter: `location=eq.${currentLocation}`,
        },
        (payload) => {
          console.log('[useSurfData] Weather forecast updated for current location, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0; // Reset debounce for real-time update
            fetchData();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for tide data
    const tideSubscription = supabase
      .channel(`tide_data_${currentLocation}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tide_data',
          filter: `location=eq.${currentLocation}`,
        },
        (payload) => {
          console.log('[useSurfData] Tide data updated for current location, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0; // Reset debounce for real-time update
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useSurfData] Cleaning up real-time subscriptions...');
      surfReportsSubscription.unsubscribe();
      weatherSubscription.unsubscribe();
      forecastSubscription.unsubscribe();
      tideSubscription.unsubscribe();
    };
  }, [currentLocation, fetchData]);

  // ✅ CRITICAL FIX: Cleanup on unmount
  useEffect(() => {
    console.log('[useSurfData] Hook mounted');
    isMountedRef.current = true;

    return () => {
      console.log('[useSurfData] Hook unmounting, cleaning up...');
      isMountedRef.current = false;
      isFetchingRef.current = false;
      
      // Clear intervals and timeouts
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    refreshData: fetchData,
    updateAllData,
  };
}
