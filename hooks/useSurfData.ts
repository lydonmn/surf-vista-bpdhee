
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';

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

export function useSurfData() {
  const { currentLocation } = useLocation();
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
  const lastFetchDateRef = useRef<string>(getESTDate()); // Track the date of last fetch

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
      // Skip debounce check when date changes
    } else {
      // Debounce - don't fetch if we just fetched within last 5 seconds (same day only)
      if (timeSinceLastFetch < DEBOUNCE_DELAY) {
        console.log('[useSurfData] Fetch called too soon after last fetch (', timeSinceLastFetch, 'ms), skipping...');
        return;
      }
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current date in EST
      const today = getESTDate();
      const location = currentLocationRef.current;
      
      console.log('[useSurfData] ═══════════════════════════════════════');
      console.log('[useSurfData] 🔄 FETCHING DATA');
      console.log('[useSurfData] Location:', location);
      console.log('[useSurfData] EST date:', today);
      console.log('[useSurfData] Last fetch date:', lastFetchDateRef.current);
      console.log('[useSurfData] Date changed:', dateChanged);
      console.log('[useSurfData] Timestamp:', new Date().toISOString());
      console.log('[useSurfData] ═══════════════════════════════════════');
      
      // Fetch all data in parallel with location filter
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

      if (!isMountedRef.current) {
        isFetchingRef.current = false;
        return;
      }

      if (surfReportsResult.error) {
        console.error('[useSurfData] Surf reports error:', surfReportsResult.error);
        throw surfReportsResult.error;
      }
      if (surfConditionsResult.error) {
        console.error('[useSurfData] Surf conditions error:', surfConditionsResult.error);
        throw surfConditionsResult.error;
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

      console.log('[useSurfData] ═══════════════════════════════════════');
      console.log('[useSurfData] ✅ DATA FETCHED SUCCESSFULLY');
      console.log('[useSurfData] Location:', location);
      console.log('[useSurfData] Surf reports count:', surfReportsResult.data?.length || 0);
      console.log('[useSurfData] Has surf conditions:', !!surfConditionsResult.data);
      console.log('[useSurfData] Has weather data:', !!weatherResult.data);
      console.log('[useSurfData] Weather forecast count:', forecastResult.data?.length || 0);
      console.log('[useSurfData] Tide data count:', tideResult.data?.length || 0);
      
      // 🚨 CRITICAL DEBUG: Log wind data from all sources
      if (weatherResult.data) {
        console.log('[useSurfData] 🌬️ WEATHER DATA WIND:', {
          wind_speed: weatherResult.data.wind_speed,
          wind_speed_type: typeof weatherResult.data.wind_speed,
          wind_direction: weatherResult.data.wind_direction,
          wind_direction_type: typeof weatherResult.data.wind_direction,
          location: weatherResult.data.location,
          date: weatherResult.data.date,
        });
      }
      
      if (surfConditionsResult.data) {
        console.log('[useSurfData] 🌊 SURF CONDITIONS WIND:', {
          wind_speed: surfConditionsResult.data.wind_speed,
          wind_speed_type: typeof surfConditionsResult.data.wind_speed,
          wind_direction: surfConditionsResult.data.wind_direction,
          wind_direction_type: typeof surfConditionsResult.data.wind_direction,
          location: surfConditionsResult.data.location,
          date: surfConditionsResult.data.date,
        });
      }
      
      const todayReportBeforeMerge = surfReportsResult.data?.find(r => r.date.split('T')[0] === today);
      if (todayReportBeforeMerge) {
        console.log('[useSurfData] 📋 TODAY\'S REPORT WIND (before merge):', {
          wind_speed: todayReportBeforeMerge.wind_speed,
          wind_speed_type: typeof todayReportBeforeMerge.wind_speed,
          wind_direction: todayReportBeforeMerge.wind_direction,
          wind_direction_type: typeof todayReportBeforeMerge.wind_direction,
          location: todayReportBeforeMerge.location,
          date: todayReportBeforeMerge.date,
        });
      }
      
      console.log('[useSurfData] ═══════════════════════════════════════');
      
      // 🚨 CRITICAL FIX: Log the narrative from today's report
      const todayReport = surfReportsResult.data?.find(r => r.date.split('T')[0] === today);
      if (todayReport) {
        console.log('[useSurfData] ===== TODAY\'S REPORT NARRATIVE =====');
        console.log('[useSurfData] Report ID:', todayReport.id);
        console.log('[useSurfData] Report location:', todayReport.location);
        console.log('[useSurfData] Has conditions:', !!todayReport.conditions);
        console.log('[useSurfData] Has report_text:', !!todayReport.report_text);
        console.log('[useSurfData] Conditions length:', todayReport.conditions?.length || 0);
        console.log('[useSurfData] Report_text length:', todayReport.report_text?.length || 0);
        console.log('[useSurfData] Narrative preview:', (todayReport.conditions || todayReport.report_text || '').substring(0, 150));
        console.log('[useSurfData] Updated at:', todayReport.updated_at);
        console.log('[useSurfData] =====================================');
      } else {
        console.log('[useSurfData] ⚠️ No report found for today:', today);
      }

      // CRITICAL FIX: Merge surf_conditions data into surf_reports for today
      const mergedReports = (surfReportsResult.data || []).map(report => {
        const reportDate = report.date.split('T')[0];
        
        // If this is today's report and we have fresh surf_conditions, merge them
        if (reportDate === today && surfConditionsResult.data) {
          const conditions = surfConditionsResult.data;
          console.log(`[useSurfData] Merging today's surf_conditions into report:`, {
            report_wave_height: report.wave_height,
            report_surf_height: report.surf_height,
            conditions_wave_height: conditions.wave_height,
            conditions_surf_height: conditions.surf_height,
            report_wind: `${report.wind_speed} ${report.wind_direction}`,
            conditions_wind: `${conditions.wind_speed} ${conditions.wind_direction}`,
            report_wind_types: `${typeof report.wind_speed} ${typeof report.wind_direction}`,
            conditions_wind_types: `${typeof conditions.wind_speed} ${typeof conditions.wind_direction}`,
          });
          
          // Helper function to check if a value is valid (not null, not "N/A", not empty)
          const isValidValue = (val: any) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'string') {
              const trimmed = val.trim();
              // Check if it's not empty and not "N/A" (case insensitive)
              if (trimmed === '' || trimmed.toLowerCase() === 'n/a') return false;
              // If it's a numeric string, check if it's a valid number
              const num = Number(trimmed);
              if (!isNaN(num)) {
                return true; // Valid numeric string (including "0")
              }
              return true; // Valid non-numeric string (like "E", "NW", etc.)
            }
            if (typeof val === 'number') {
              return !isNaN(val); // Valid number (including 0)
            }
            return true;
          };
          
          // Only use surf_conditions values if they are valid, otherwise keep report values
          const merged = {
            ...report,
            wave_height: isValidValue(conditions.wave_height) ? conditions.wave_height : report.wave_height,
            surf_height: isValidValue(conditions.surf_height) ? conditions.surf_height : report.surf_height,
            wave_period: isValidValue(conditions.wave_period) ? conditions.wave_period : report.wave_period,
            swell_direction: isValidValue(conditions.swell_direction) ? conditions.swell_direction : report.swell_direction,
            wind_speed: isValidValue(conditions.wind_speed) ? conditions.wind_speed : report.wind_speed,
            wind_direction: isValidValue(conditions.wind_direction) ? conditions.wind_direction : report.wind_direction,
            water_temp: isValidValue(conditions.water_temp) ? conditions.water_temp : report.water_temp,
          };
          
          console.log(`[useSurfData] Merged result wind data:`, {
            merged_wind_speed: merged.wind_speed,
            merged_wind_direction: merged.wind_direction,
            merged_wind_types: `${typeof merged.wind_speed} ${typeof merged.wind_direction}`,
          });
          
          return merged;
        }
        
        return report;
      });
      
      console.log('[useSurfData] Merged reports with real-time conditions:', mergedReports.length);
      
      // 🚨 CRITICAL DEBUG: Log wind data after merge
      const todayReportAfterMerge = mergedReports.find(r => r.date.split('T')[0] === today);
      if (todayReportAfterMerge) {
        console.log('[useSurfData] 📋 TODAY\'S REPORT WIND (after merge):', {
          wind_speed: todayReportAfterMerge.wind_speed,
          wind_speed_type: typeof todayReportAfterMerge.wind_speed,
          wind_direction: todayReportAfterMerge.wind_direction,
          wind_direction_type: typeof todayReportAfterMerge.wind_direction,
          location: todayReportAfterMerge.location,
          date: todayReportAfterMerge.date,
        });
      }

      // Check if we have any data for this location
      const hasData = (mergedReports && mergedReports.length > 0) ||
                      weatherResult.data ||
                      (forecastResult.data && forecastResult.data.length > 0) ||
                      (tideResult.data && tideResult.data.length > 0);

      if (isMountedRef.current) {
        setState({
          surfReports: mergedReports,
          surfConditions: surfConditionsResult.data,
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
          fetchDataRef.current?.();
        }, RETRY_DELAY);
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Stable wrapper function
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

      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT);

      try {
        // Call the unified edge function with location parameter
        const response = await Promise.race([
          supabase.functions.invoke('update-all-surf-data', {
            body: { location },
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

        // Wait for database to update before refreshing
        console.log('[useSurfData] Waiting for database to update...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Refresh data from database
        console.log('[useSurfData] Refreshing data from database...');
        isFetchingRef.current = false;
        lastFetchTimeRef.current = 0; // Reset debounce for manual update
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
  }, []);

  // Update currentLocationRef when location changes
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  // Fetch data when location changes
  useEffect(() => {
    console.log('[useSurfData] Location changed to:', currentLocation);
    if (!isFetchingRef.current) {
      lastFetchTimeRef.current = 0; // Reset debounce for location change
      fetchData();
    }
  }, [currentLocation, fetchData]);

  // Stable periodic refresh setup with date change detection
  useEffect(() => {
    console.log('[useSurfData] Setting up periodic refresh (every 30 minutes) with date change detection...');
    
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval - check every 30 minutes
    refreshIntervalRef.current = setInterval(() => {
      const currentDate = getESTDate();
      const dateChanged = currentDate !== lastFetchDateRef.current;
      
      if (dateChanged) {
        console.log('[useSurfData] 📅 DATE CHANGED during periodic check!');
        console.log('[useSurfData] Last fetch:', lastFetchDateRef.current, '→ Current:', currentDate);
        console.log('[useSurfData] Forcing immediate refresh for new day...');
        lastFetchDateRef.current = currentDate;
        lastFetchTimeRef.current = 0; // Reset debounce
        if (!isFetchingRef.current) {
          fetchData();
        }
      } else {
        console.log('[useSurfData] Periodic refresh triggered (same day)');
        if (!isFetchingRef.current) {
          fetchData();
        }
      }
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchData]);

  // Stable app state change handler with date change detection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[useSurfData] App state changed:', appStateRef.current, '->', nextAppState);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        const currentDate = getESTDate();
        const dateChanged = currentDate !== lastFetchDateRef.current;
        
        if (dateChanged) {
          console.log('[useSurfData] 📅 DATE CHANGED while app was in background!');
          console.log('[useSurfData] Last fetch:', lastFetchDateRef.current, '→ Current:', currentDate);
          console.log('[useSurfData] Forcing immediate refresh for new day...');
          lastFetchDateRef.current = currentDate;
          lastFetchTimeRef.current = 0; // Reset debounce
        } else {
          console.log('[useSurfData] App came to foreground (same day), refreshing data...');
        }
        
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

  // Set up real-time subscriptions with stable dependencies
  useEffect(() => {
    console.log('[useSurfData] Setting up real-time subscriptions for location:', currentLocation);

    // Set up real-time subscription for surf reports
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
        (payload) => {
          console.log('[useSurfData] ═══════════════════════════════════════');
          console.log('[useSurfData] 🔔 REAL-TIME UPDATE: Surf report changed!');
          console.log('[useSurfData] Event:', payload.eventType);
          console.log('[useSurfData] Location:', currentLocation);
          console.log('[useSurfData] Payload:', payload);
          console.log('[useSurfData] 🔄 Forcing immediate refresh...');
          console.log('[useSurfData] ═══════════════════════════════════════');
          
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0; // Reset debounce for real-time update
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for surf conditions
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
        (payload) => {
          console.log('[useSurfData] 🔔 Surf conditions updated, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for weather data
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
        (payload) => {
          console.log('[useSurfData] 🔔 Weather data updated, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for weather forecast
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
        (payload) => {
          console.log('[useSurfData] 🔔 Weather forecast updated, refreshing data...');
          if (!isFetchingRef.current) {
            lastFetchTimeRef.current = 0;
            fetchDataRef.current?.();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for tide data
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
        (payload) => {
          console.log('[useSurfData] 🔔 Tide data updated, refreshing data...');
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

  // Cleanup on unmount
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
