
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

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  // Get EST time by using toLocaleString with America/New_York timezone
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the EST date string (format: MM/DD/YYYY)
  const [month, day, year] = estDateString.split('/');
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

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
    const today = getESTDate();
    console.log('Current EST date:', today);
    console.log('Current UTC time:', new Date().toISOString());

    // Step 3: Store current weather data (first period)
    const currentPeriod = periods[0];
    
    // Match the existing database schema - convert numeric fields to strings
    const weatherData = {
      date: today,
      temperature: currentPeriod.temperature.toString(),
      feels_like: currentPeriod.temperature.toString(),
      humidity: 0,
      wind_speed: currentPeriod.windSpeed.split(' ')[0], // Extract just the number
      wind_direction: currentPeriod.windDirection,
      wind_gust: '0',
      pressure: '0',
      visibility: '10',
      conditions: currentPeriod.shortForecast,
      forecast: currentPeriod.detailedForecast,
      raw_data: {
        forecast: currentPeriod
      },
      updated_at: new Date().toISOString(),
    };

    console.log('Upserting current weather data for date:', today);
    console.log('Weather data to insert:', JSON.stringify(weatherData, null, 2));

    const { data: weatherInsertData, error: weatherError } = await supabase
      .from('weather_data')
      .upsert(weatherData, { onConflict: 'date' })
      .select();

    if (weatherError) {
      console.error('Error storing weather data:', weatherError);
      console.error('Error details:', JSON.stringify(weatherError, null, 2));
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

    console.log('Weather data stored successfully:', weatherInsertData);

    // Step 4: Store 7-day forecast with aggregated daily data
    // Group periods by date and aggregate high/low temps
    const dailyForecasts = new Map<string, any>();
    
    for (let i = 0; i < Math.min(periods.length, 14); i++) {
      const period = periods[i];
      
      // Parse the start time to get the date in EST
      const periodDate = new Date(period.startTime);
      const estDateString = periodDate.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [month, day, year] = estDateString.split('/');
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Get or create daily forecast entry
      if (!dailyForecasts.has(formattedDate)) {
        dailyForecasts.set(formattedDate, {
          date: formattedDate,
          day_name: period.name.includes('Night') ? period.name.replace(' Night', '') : period.name,
          high_temp: null,
          low_temp: null,
          conditions: period.shortForecast,
          icon: period.icon,
          wind_speed: parseInt(period.windSpeed.split(' ')[0]) || 0,
          wind_direction: period.windDirection,
          precipitation_chance: period.probabilityOfPrecipitation?.value || 0,
          humidity: 0,
          swell_height_min: null,
          swell_height_max: null,
          swell_height_range: '1-2 ft', // Default, will be updated if we have surf data
          updated_at: new Date().toISOString(),
        });
      }
      
      const dailyData = dailyForecasts.get(formattedDate);
      
      // Update high/low temps
      if (period.isDaytime) {
        if (dailyData.high_temp === null || period.temperature > dailyData.high_temp) {
          dailyData.high_temp = period.temperature;
        }
      } else {
        if (dailyData.low_temp === null || period.temperature < dailyData.low_temp) {
          dailyData.low_temp = period.temperature;
        }
      }
      
      // Use daytime conditions as primary
      if (period.isDaytime) {
        dailyData.conditions = period.shortForecast;
        dailyData.icon = period.icon;
        dailyData.day_name = period.name;
      }
    }

    const forecastRecords = Array.from(dailyForecasts.values());
    console.log(`Prepared ${forecastRecords.length} daily forecast records`);

    // Delete ALL old forecasts first to prevent duplicates
    const { error: deleteError } = await supabase
      .from('weather_forecast')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      console.error('Error deleting old forecasts:', deleteError);
    } else {
      console.log('Deleted all old forecast records');
    }

    // Insert new forecasts
    const { data: forecastInsertData, error: forecastError } = await supabase
      .from('weather_forecast')
      .insert(forecastRecords)
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
