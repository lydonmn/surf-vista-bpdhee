
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';

type SurfReport = Database['public']['Tables']['surf_reports']['Row'];
type WeatherData = Database['public']['Tables']['weather_data']['Row'];
type WeatherForecast = Database['public']['Tables']['weather_forecast']['Row'];
type TideData = Database['public']['Tables']['tide_data']['Row'];
type SurfConditions = Database['public']['Tables']['surf_conditions']['Row'];

interface SurfDataState {
  surfReports: SurfReport[];
  surfConditions: SurfConditions | null;
  weatherData: WeatherData | null;
  weatherForecast: WeatherForecast[];
  tideData: TideData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const RETRY_DELAY = 5000; // 5 seconds
const FUNCTION_TIMEOUT = 60000; // 60 seconds
const DEBOUNCE_DELAY = 5000; // 5 seconds

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  
  const estDateString = now.toLocaleDateString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = estDateString.split('/');
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

// 🚨 CRITICAL FIX: Accept currentLocation as parameter instead of calling useLocation()
export function useSurfData(currentLocation: string) {
  const [state, setState] = useState<SurfDataState>({
    surfReports: [],
    surfConditions: null,
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
  const currentLocationRef = useRef(currentLocation);
  const lastFetchDateRef = useRef<string>(getESTDate());

  // Stable fetchData function with no dependencies
  const fetchDataRef = useRef<() => Promise<void>>();
  
  fetchDataRef.current = async () => {
    // Prevent concurrent fetches and debounce rapid calls
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const currentDate = getESTDate();
    const dateChanged = currentDate !== lastFetchDateRef.current;
    
    if (!isMountedRef.current || isFetchingRef.current) {
      console.log('[useSurfData] Fetch already in progress or component unmounted, skipping...');
      return;
    }

    // 🚨 CRITICAL FIX: Always fetch if the date has changed (new day)
    if (dateChanged) {
      console.log('[useSurfData] 📅 DATE CHANGED! Last fetch:', lastFetchDateRef.current, '→ Current:', currentDate);
      console.log('[useSurfData] Forcing immediate refresh for new day...');
      lastFetchDateRef.current = currentDate;
    } else {
      if (timeSinceLastFetch < DEBOUNCE_DELAY) {
        console.log('[useSurfData] Fetch called too soon after last fetch (', timeSinceLastFetch, 'ms), skipping...');
        return;
      }
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const today = getESTDate();
      const location = currentLocationRef.current;
      
      console.log('[useSurfData] ═══════════════════════════════════════');
      console.log('[useSurfData] 🔄 FETCHING DATA');
      console.log('[useSurfData] Location:', location);
      console.log('[useSurfData] EST date:', today);
      console.log('[useSurfData] ═══════════════════════════════════════');
      
      const hasValidWaveData = (data: any): boolean => {
        if (!data) return false;
        const waveHeight = data.wave_height;
        const surfHeight = data.surf_height;
        
        const hasWave = waveHeight && 
                       waveHeight !== 'N/A' && 
                       waveHeight !== null && 
                       waveHeight !== '' &&
                       waveHeight !== '99.0' &&
                       waveHeight !== '99.0 ft';
        const hasSurf = surfHeight && 
                       surfHeight !== 'N/A' && 
                       surfHeight !== null && 
                       surfHeight !== '' &&
                       surfHeight !== '99.0' &&
                       surfHeight !== '99.0 ft';
        
        return hasWave || hasSurf;
      };

      const [surfReportsResult, surfConditionsResult, weatherResult, forecastResult, tideResult] = await Promise.all([
        supabase
          .from('surf_reports')
          .select('*')
          .eq('location', location)
          .order('date', { ascending: false })
          .limit(7),
        supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', location)
          .eq('date', today)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('weather_data')
          .select('*')
          .eq('location', location)
          .eq('date', today)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('weather_forecast')
          .select('*')
          .eq('location', location)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(7),
        supabase
          .from('tide_data')
          .select('*')
          .eq('location', location)
          .gte('date', today)
          .order('date', { ascending: true })
          .order('time', { ascending: true }),
      ]);

      let finalSurfConditions = surfConditionsResult.data;
      
      if (finalSurfConditions && !hasValidWaveData(finalSurfConditions)) {
        console.log('[useSurfData] ⚠️ Today\'s surf_conditions has N/A wave data, fetching most recent valid data...');
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        
        const { data: recentValidData } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', location)
          .gte('date', sevenDaysAgoStr)
          .order('updated_at', { ascending: false })
          .limit(50);
        
        if (recentValidData && recentValidData.length > 0) {
          const validRecord = recentValidData.find(record => hasValidWaveData(record));
          
          if (validRecord) {
            console.log('[useSurfData] ✅ Found most recent valid wave data from:', validRecord.updated_at);
            
            finalSurfConditions = {
              ...finalSurfConditions,
              wave_height: validRecord.wave_height,
              surf_height: validRecord.surf_height,
              wave_period: validRecord.wave_period,
              swell_direction: validRecord.swell_direction,
              wind_speed: finalSurfConditions.wind_speed,
              wind_direction: finalSurfConditions.wind_direction,
              water_temp: finalSurfConditions.water_temp,
            };
          }
        }
      }

      if (!isMountedRef.current) {
        isFetchingRef.current = false;
        return;
      }

      if (surfReportsResult.error) throw surfReportsResult.error;
      if (surfConditionsResult.error) throw surfConditionsResult.error;
      if (weatherResult.error) throw weatherResult.error;
      if (forecastResult.error) throw forecastResult.error;
      if (tideResult.error) throw tideResult.error;

      console.log('[useSurfData] ✅ DATA FETCHED SUCCESSFULLY');
      
      const isValidValue = (val: any) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '' || trimmed.toLowerCase() === 'n/a') return false;
          const num = Number(trimmed);
          if (!isNaN(num)) return true;
          return true;
        }
        if (typeof val === 'number') return !isNaN(val);
        return true;
      };

      const mergedReports = (surfReportsResult.data || []).map(report => {
        const reportDate = report.date.split('T')[0];
        
        if (reportDate === today && finalSurfConditions) {
          const conditions = finalSurfConditions;
          
          return {
            ...report,
            wave_height: isValidValue(conditions.wave_height) ? conditions.wave_height : report.wave_height,
            surf_height: isValidValue(conditions.surf_height) ? conditions.surf_height : report.surf_height,
            wave_period: isValidValue(conditions.wave_period) ? conditions.wave_period : report.wave_period,
            swell_direction: isValidValue(conditions.swell_direction) ? conditions.swell_direction : report.swell_direction,
            wind_speed: isValidValue(conditions.wind_speed) ? conditions.wind_speed : report.wind_speed,
            wind_direction: isValidValue(conditions.wind_direction) ? conditions.wind_direction : report.wind_direction,
            water_temp: isValidValue(conditions.water_temp) ? conditions.water_temp : report.water_temp,
          };
        }
        
        return report;
      });

      const hasData = (mergedReports && mergedReports.length > 0) ||
                      weatherResult.data ||
                      (forecastResult.data && forecastResult.data.length > 0) ||
                      (tideResult.data && tideResult.data.length > 0);

      if (isMountedRef.current) {
        setState({
          surfReports: mergedReports,
          surfConditions: finalSurfConditions,
          weatherData: weatherResult.data,
          weatherForecast: forecastResult.data || [],
          tideData: tideResult.data || [],
          isLoading: false,
          error: !hasData && location === 'pawleys-island' 
            ? 'Data for Pawleys Island is being set up. Please tap "Update Data" to fetch the latest conditions.' 
            : null,
          lastUpdated: new Date(),
        });
      }

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

        retryTimeoutRef.current = setTimeout(() => {
          console.log('[useSurfData] Retrying data fetch...');
          isFetchingRef.current = false;
          lastFetchTimeRef.current = 0;
          fetchDataRef.current?.();
        }, RETRY_DELAY);
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  const fetchData = useCallback(() => {
    fetchDataRef.current?.();
  }, []);

  const updateAllData = useCallback(async () => {
    if (!isMountedRef.current || isUpdatingRef.current) {
      console.log('[useSurfData] Update already in progress, skipping...');
      return;
    }

    try {
      isUpdatingRef.current = true;
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const location = currentLocationRef.current;
      console.log('[useSurfData] Updating all data via Edge Functions for location:', location);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT);

      try {
        const response = await Promise.race([
          supabase.functions.invoke('update-all-surf-data', {
            body: { location },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout - please try again')), FUNCTION_TIMEOUT)
          )
        ]) as any;

        clearTimeout(timeoutId);

        if (response.error) {
          let errorMsg = 'Update failed';
          if (response.error.message) {
            errorMsg = response.error.message;
          } else if (typeof response.error === 'string') {
            errorMsg = response.error;
          }
          
          if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network request failed')) {
            errorMsg = 'Network error - please check your internet connection and try again';
          }
          
          throw new Error(errorMsg);
        }

        if (response.data && !response.data.success) {
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

        await new Promise(resolve => setTimeout(resolve, 1500));

        isFetchingRef.current = false;
        lastFetchTimeRef.current = 0;
        await fetchDataRef.current?.();
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
        
        throw new Error(errorMessage);
      }
    } finally {
      isUpdatingRef.current = false;
    }
  }, []);

  // 🚨 CRITICAL FIX: Update location ref and trigger fetch without circular dependency
  useEffect(() => {
    console.log('[useSurfData] Location changed to:', currentLocation);
    currentLocationRef.current = currentLocation;
    
    // Reset fetch state and trigger immediate fetch
    if (!isFetchingRef.current) {
      lastFetchTimeRef.current = 0;
      // Call fetchDataRef.current directly to avoid dependency on fetchData
      fetchDataRef.current?.();
    }
  }, [currentLocation]); // Only depend on currentLocation, not fetchData

  // 🚨 CRITICAL FIX: Set up periodic refresh without dependency on fetchData
  useEffect(() => {
    console.log('[useSurfData] Setting up periodic refresh...');
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = setInterval(() => {
      const currentDate = getESTDate();
      const dateChanged = currentDate !== lastFetchDateRef.current;
      
      if (dateChanged) {
        console.log('[useSurfData] 📅 DATE CHANGED during periodic check!');
        lastFetchDateRef.current = currentDate;
        lastFetchTimeRef.current = 0;
        if (!isFetchingRef.current) {
          fetchDataRef.current?.(); // Use ref instead of fetchData
        }
      } else {
        if (!isFetchingRef.current) {
          fetchDataRef.current?.(); // Use ref instead of fetchData
        }
      }
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []); // No dependencies - stable interval

  // 🚨 CRITICAL FIX: App state listener without dependency on fetchData
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[useSurfData] App state changed:', appStateRef.current, '->', nextAppState);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        const currentDate = getESTDate();
        const dateChanged = currentDate !== lastFetchDateRef.current;
        
        if (dateChanged) {
          console.log('[useSurfData] 📅 DATE CHANGED while app was in background!');
          lastFetchDateRef.current = currentDate;
        }

        // Reset debounce timer so foreground resume always triggers a fresh fetch
        lastFetchTimeRef.current = 0;
        // Also reset the fetching guard in case it got stuck
        isFetchingRef.current = false;

        console.log('[useSurfData] App foregrounded — forcing fresh fetch');
        fetchDataRef.current?.();
      }
      
      appStateRef.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
    };
  }, []); // No dependencies - stable listener

  useEffect(() => {
    console.log('[useSurfData] Setting up real-time subscriptions for location:', currentLocation);

    const surfReportsSubscription = supabase
      .channel(`surf_reports_${currentLocation}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'surf_reports',
          filter: `location=eq.${currentLocation}`,
        },
        () => {
          console.log('[useSurfData] 🔔 Surf report updated, refreshing...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    const surfConditionsSubscription = supabase
      .channel(`surf_conditions_${currentLocation}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'surf_conditions',
          filter: `location=eq.${currentLocation}`,
        },
        () => {
          console.log('[useSurfData] 🔔 Surf conditions updated, refreshing...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    const weatherSubscription = supabase
      .channel(`weather_data_${currentLocation}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weather_data',
          filter: `location=eq.${currentLocation}`,
        },
        () => {
          console.log('[useSurfData] 🔔 Weather data updated, refreshing...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    const forecastSubscription = supabase
      .channel(`weather_forecast_${currentLocation}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weather_forecast',
          filter: `location=eq.${currentLocation}`,
        },
        () => {
          console.log('[useSurfData] 🔔 Weather forecast updated, refreshing...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    const tideSubscription = supabase
      .channel(`tide_data_${currentLocation}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tide_data',
          filter: `location=eq.${currentLocation}`,
        },
        () => {
          console.log('[useSurfData] 🔔 Tide data updated, refreshing...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useSurfData] Cleaning up real-time subscriptions...');
      surfReportsSubscription.unsubscribe();
      surfConditionsSubscription.unsubscribe();
      weatherSubscription.unsubscribe();
      forecastSubscription.unsubscribe();
      tideSubscription.unsubscribe();
    };
  }, [currentLocation]);

  useEffect(() => {
    console.log('[useSurfData] Hook mounted');
    isMountedRef.current = true;

    return () => {
      console.log('[useSurfData] Hook unmounting, cleaning up...');
      isMountedRef.current = false;
      isFetchingRef.current = false;
      
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
