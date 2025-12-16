
import { useState, useEffect } from 'react';
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

  const fetchData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const today = new Date().toISOString().split('T')[0];

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

      if (surfReportsResult.error) throw surfReportsResult.error;
      if (weatherResult.error) throw weatherResult.error;
      if (forecastResult.error) throw forecastResult.error;
      if (tideResult.error) throw tideResult.error;

      setState({
        surfReports: surfReportsResult.data || [],
        weatherData: weatherResult.data,
        weatherForecast: forecastResult.data || [],
        tideData: tideResult.data || [],
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error fetching surf data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch data',
      }));
    }
  };

  const updateAllData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Call edge functions to update data
      const [weatherResponse, tideResponse, surfResponse] = await Promise.all([
        supabase.functions.invoke('fetch-weather-data'),
        supabase.functions.invoke('fetch-tide-data'),
        supabase.functions.invoke('fetch-surf-reports'),
      ]);

      // Check for errors
      if (weatherResponse.error) throw new Error('Weather update failed');
      if (tideResponse.error) throw new Error('Tide update failed');
      if (surfResponse.error) throw new Error('Surf report update failed');

      // Generate daily report
      const reportResponse = await supabase.functions.invoke('generate-daily-report');
      if (reportResponse.error) throw new Error('Daily report generation failed');

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error updating surf data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update data',
      }));
    }
  };

  useEffect(() => {
    fetchData();

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
          console.log('Surf report updated, refreshing data...');
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
          console.log('Weather data updated, refreshing data...');
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
          console.log('Weather forecast updated, refreshing data...');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      surfReportsSubscription.unsubscribe();
      weatherSubscription.unsubscribe();
      forecastSubscription.unsubscribe();
    };
  }, []);

  return {
    ...state,
    refreshData: fetchData,
    updateAllData,
  };
}
