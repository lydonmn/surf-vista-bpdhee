
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';

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

const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
const RETRY_DELAY = 5000; // 5 seconds
const FUNCTION_TIMEOUT = 60000; // 60 seconds

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  // Convert to EST by subtracting 5 hours (EST is UTC-5)
  const estTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  const year = estTime.getUTCFullYear();
  const month = String(estTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(estTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useSurfData() {
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

  // Memoize fetchData to prevent infinite loops
  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current date in EST
      const today = getESTDate();
      
      console.log('[useSurfData] Fetching data for EST date:', today);
      console.log('[useSurfData] Current UTC time:', new Date().toISOString());

      // Fetch all data in parallel
      const [surfReportsResult, weatherResult, forecastResult, tideResult] = await Promise.all([
        supabase
          .from('surf_reports')
          .select('*')
          .order('date', { ascending: false })
          .limit(7),
        supabase
          .from('weather_data')
          .select('*')
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('weather_forecast')
          .select('*')
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(7),
        supabase
          .from('tide_data')
          .select('*')
          .eq('date', today)
          .order('time'),
      ]);

      if (!isMountedRef.current) return;

      // Log detailed results
      console.log('[useSurfData] Surf reports result:', {
        error: surfReportsResult.error,
        count: surfReportsResult.data?.length || 0,
        dates: surfReportsResult.data?.map(r => r.date) || [],
      });

      console.log('[useSurfData] Weather result:', {
        error: weatherResult.error,
        hasData: !!weatherResult.data,
        date: weatherResult.data?.date,
        updated_at: weatherResult.data?.updated_at,
      });

      console.log('[useSurfData] Forecast result:', {
        error: forecastResult.error,
        count: forecastResult.data?.length || 0,
        dates: forecastResult.data?.map(f => f.date) || [],
      });

      console.log('[useSurfData] Tide result:', {
        error: tideResult.error,
        count: tideResult.data?.length || 0,
      });

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

      console.log('[useSurfData] Data fetched successfully');

      if (isMountedRef.current) {
        setState({
          surfReports: surfReportsResult.data || [],
          weatherData: weatherResult.data,
          weatherForecast: forecastResult.data || [],
          tideData: tideResult.data || [],
          isLoading: false,
          error: null,
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
          fetchData();
        }, RETRY_DELAY);
      }
    }
  }, []); // Empty dependency array - this function doesn't depend on any props or state

  const updateAllData = useCallback(async () => {
    if (!isMountedRef.current || isUpdatingRef.current) {
      console.log('[useSurfData] Update already in progress, skipping...');
      return;
    }

    try {
      isUpdatingRef.current = true;
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log('[useSurfData] Updating all data via Edge Functions...');

      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT);

      try {
        // Call the new unified edge function with timeout
        const response = await Promise.race([
          supabase.functions.invoke('update-all-surf-data', {
            body: {},
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

        // Refresh data from database
        console.log('[useSurfData] Refreshing data from database...');
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
  }, [fetchData]);

  // Setup periodic refresh - memoized
  const setupPeriodicRefresh = useCallback(() => {
    console.log('[useSurfData] Setting up periodic refresh (every 15 minutes)...');
    
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval
    refreshIntervalRef.current = setInterval(() => {
      console.log('[useSurfData] Periodic refresh triggered');
      fetchData();
    }, REFRESH_INTERVAL);
  }, [fetchData]);

  // Handle app state changes - memoized
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log('[useSurfData] App state changed:', appStateRef.current, '->', nextAppState);
    
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[useSurfData] App came to foreground, refreshing data...');
      fetchData();
    }
    
    appStateRef.current = nextAppState;
  }, [fetchData]);

  useEffect(() => {
    console.log('[useSurfData] Initializing...');
    isMountedRef.current = true;
    
    // Initial data fetch
    fetchData();

    // Setup periodic refresh
    setupPeriodicRefresh();

    // Setup app state listener
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Set up real-time subscription for surf reports
    const surfReportsSubscription = supabase
      .channel('surf_reports_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'surf_reports',
        },
        () => {
          console.log('[useSurfData] Surf report updated, refreshing data...');
          fetchData();
        }
      )
      .subscribe();

    // Set up real-time subscription for weather data
    const weatherSubscription = supabase
      .channel('weather_data_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weather_data',
        },
        () => {
          console.log('[useSurfData] Weather data updated, refreshing data...');
          fetchData();
        }
      )
      .subscribe();

    // Set up real-time subscription for weather forecast
    const forecastSubscription = supabase
      .channel('weather_forecast_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weather_forecast',
        },
        () => {
          console.log('[useSurfData] Weather forecast updated, refreshing data...');
          fetchData();
        }
      )
      .subscribe();

    // Set up real-time subscription for tide data
    const tideSubscription = supabase
      .channel('tide_data_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tide_data',
        },
        (payload) => {
          console.log('[useSurfData] Tide data updated, payload:', payload);
          console.log('[useSurfData] Refreshing data...');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      console.log('[useSurfData] Cleaning up...');
      isMountedRef.current = false;
      
      // Clear intervals and timeouts
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Remove app state listener
      appStateSubscription.remove();

      // Unsubscribe from real-time channels
      surfReportsSubscription.unsubscribe();
      weatherSubscription.unsubscribe();
      forecastSubscription.unsubscribe();
      tideSubscription.unsubscribe();
    };
  }, [fetchData, handleAppStateChange, setupPeriodicRefresh]);

  return {
    ...state,
    refreshData: fetchData,
    updateAllData,
  };
}
