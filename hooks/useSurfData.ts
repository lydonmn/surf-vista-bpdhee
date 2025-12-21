
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
      const now = new Date();
      const estDateString = now.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      // Parse the EST date string (format: MM/DD/YYYY)
      const [month, day, year] = estDateString.split('/');
      const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      console.log('[useSurfData] Fetching data for EST date:', today);
      console.log('[useSurfData] Current UTC time:', now.toISOString());

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

      // Call the new unified edge function
      const response = await supabase.functions.invoke('update-all-surf-data');

      console.log('[useSurfData] Update response:', { 
        data: response.data, 
        error: response.error,
        status: (response as any).status 
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
        
        throw new Error(errorMsg);
      }

      // Check if the response data indicates failure
      if (response.data && !response.data.success) {
        console.error('[useSurfData] Update failed:', response.data.errors);
        
        // If there are errors but some data was updated, still refresh
        if (response.data.results) {
          const successCount = Object.values(response.data.results).filter((r: any) => r?.success).length;
          console.log(`[useSurfData] Partial success: ${successCount} operations succeeded`);
          
          // Show a warning but still refresh data
          if (isMountedRef.current) {
            setState(prev => ({
              ...prev,
              error: `Some data updates failed: ${response.data.errors?.join(', ') || 'Unknown errors'}`,
            }));
          }
        } else {
          throw new Error(response.data.error || 'Update failed');
        }
      }

      // Refresh data from database
      console.log('[useSurfData] Refreshing data from database...');
      await fetchData();
    } catch (error) {
      console.error('[useSurfData] Error updating surf data:', error);
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update data';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `Update failed: ${errorMessage}. Please check the admin debug page for details.`,
        }));
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
