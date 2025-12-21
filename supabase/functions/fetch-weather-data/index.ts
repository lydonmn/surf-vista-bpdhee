
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Folly Beach coordinates
const FOLLY_BEACH_LAT = 32.6552;
const FOLLY_BEACH_LON = -79.9403;
const FETCH_TIMEOUT = 15000; // 15 seconds

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, headers: Record<string, string>, timeout: number = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH WEATHER DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      const error = 'Missing Supabase environment variables';
      console.error(error);
      return new Response(
        JSON.stringify({
          success: false,
          error,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching weather data from NOAA for Folly Beach, SC...');
    console.log('Coordinates:', { lat: FOLLY_BEACH_LAT, lon: FOLLY_BEACH_LON });

    const requestHeaders = {
      'User-Agent': 'SurfVista App (contact@surfvista.app)',
      'Accept': 'application/geo+json'
    };

    // Step 1: Get the grid point for Folly Beach
    const pointsUrl = `https://api.weather.gov/points/${FOLLY_BEACH_LAT},${FOLLY_BEACH_LON}`;
    console.log('Fetching grid point:', pointsUrl);
    
    let pointsResponse;
    try {
      pointsResponse = await fetchWithTimeout(pointsUrl, requestHeaders);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
      console.error('Failed to fetch grid point:', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch grid point: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!pointsResponse.ok) {
      const errorText = await pointsResponse.text();
      console.error('NOAA Points API error:', pointsResponse.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `NOAA Points API error: ${pointsResponse.status}`,
          details: errorText.substring(0, 200),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const pointsData = await pointsResponse.json();
    console.log('Points data received');
    
    const forecastUrl = pointsData.properties.forecast;
    const forecastHourlyUrl = pointsData.properties.forecastHourly;

    console.log('Forecast URL:', forecastUrl);

    // Step 2: Get the forecast
    let forecastResponse;
    try {
      forecastResponse = await fetchWithTimeout(forecastUrl, requestHeaders);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
      console.error('Failed to fetch forecast:', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch forecast: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!forecastResponse.ok) {
      const errorText = await forecastResponse.text();
      console.error('NOAA Forecast API error:', forecastResponse.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `NOAA Forecast API error: ${forecastResponse.status}`,
          details: errorText.substring(0, 200),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods;

    console.log(`Received ${periods.length} forecast periods`);

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
    
    console.log('Current EST date:', today);

    // Step 3: Store current weather data (first period)
    const currentPeriod = periods[0];
    
    const weatherData = {
      date: today,
      temperature: currentPeriod.temperature,
      temperature_unit: currentPeriod.temperatureUnit,
      wind_speed: currentPeriod.windSpeed,
      wind_direction: currentPeriod.windDirection,
      short_forecast: currentPeriod.shortForecast,
      detailed_forecast: currentPeriod.detailedForecast,
      icon: currentPeriod.icon,
      updated_at: new Date().toISOString(),
    };

    console.log('Upserting current weather data');

    const { data: weatherInsertData, error: weatherError } = await supabase
      .from('weather_data')
      .upsert(weatherData, { onConflict: 'date' })
      .select();

    if (weatherError) {
      console.error('Error storing weather data:', weatherError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store weather data in database',
          details: weatherError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('Weather data stored successfully');

    // Step 4: Store 7-day forecast
    const forecastRecords = [];
    
    for (let i = 0; i < Math.min(periods.length, 14); i++) {
      const period = periods[i];
      
      // Parse the start time to get the date
      const periodDate = new Date(period.startTime);
      const periodDateStr = periodDate.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [pMonth, pDay, pYear] = periodDateStr.split('/');
      const formattedDate = `${pYear}-${pMonth.padStart(2, '0')}-${pDay.padStart(2, '0')}`;
      
      forecastRecords.push({
        date: formattedDate,
        period_name: period.name,
        temperature: period.temperature,
        temperature_unit: period.temperatureUnit,
        wind_speed: period.windSpeed,
        wind_direction: period.windDirection,
        short_forecast: period.shortForecast,
        detailed_forecast: period.detailedForecast,
        icon: period.icon,
        is_daytime: period.isDaytime,
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`Upserting ${forecastRecords.length} forecast records`);

    // Delete old forecasts first (older than 2 days ago)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
    
    const { error: deleteError } = await supabase
      .from('weather_forecast')
      .delete()
      .lt('date', twoDaysAgoStr);

    if (deleteError) {
      console.error('Error deleting old forecasts:', deleteError);
    }

    // Insert new forecasts
    const { data: forecastInsertData, error: forecastError } = await supabase
      .from('weather_forecast')
      .upsert(forecastRecords, { onConflict: 'date,period_name' })
      .select();

    if (forecastError) {
      console.error('Error storing forecast data:', forecastError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store forecast data in database',
          details: forecastError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log(`Forecast data stored successfully: ${forecastInsertData?.length || 0} records`);
    console.log('=== FETCH WEATHER DATA COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Weather data updated successfully for Folly Beach, SC',
        location: 'Folly Beach, SC',
        current: weatherData,
        forecast_periods: forecastRecords.length,
        forecast_count: forecastInsertData?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH WEATHER DATA FAILED ===');
    console.error('Error in fetch-weather-data:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
