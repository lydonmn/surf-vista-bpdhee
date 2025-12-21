
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Folly Beach coordinates
const FOLLY_BEACH_LAT = 32.6552;
const FOLLY_BEACH_LON = -79.9403;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH WEATHER DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching weather data from NOAA...');
    console.log('Coordinates:', { lat: FOLLY_BEACH_LAT, lon: FOLLY_BEACH_LON });

    // Step 1: Get the grid point for Folly Beach
    const pointsUrl = `https://api.weather.gov/points/${FOLLY_BEACH_LAT},${FOLLY_BEACH_LON}`;
    console.log('Fetching grid point:', pointsUrl);
    
    const pointsResponse = await fetch(pointsUrl, {
      headers: {
        'User-Agent': 'SurfVista App (contact@surfvista.app)',
        'Accept': 'application/geo+json'
      }
    });

    if (!pointsResponse.ok) {
      const errorText = await pointsResponse.text();
      console.error('NOAA Points API error:', pointsResponse.status, errorText);
      throw new Error(`NOAA Points API error: ${pointsResponse.status} - ${errorText}`);
    }

    const pointsData = await pointsResponse.json();
    console.log('Points data received:', JSON.stringify(pointsData.properties, null, 2));
    
    const forecastUrl = pointsData.properties.forecast;
    const forecastHourlyUrl = pointsData.properties.forecastHourly;

    console.log('Forecast URL:', forecastUrl);
    console.log('Forecast Hourly URL:', forecastHourlyUrl);

    // Step 2: Get the forecast
    const forecastResponse = await fetch(forecastUrl, {
      headers: {
        'User-Agent': 'SurfVista App (contact@surfvista.app)',
        'Accept': 'application/geo+json'
      }
    });

    if (!forecastResponse.ok) {
      const errorText = await forecastResponse.text();
      console.error('NOAA Forecast API error:', forecastResponse.status, errorText);
      throw new Error(`NOAA Forecast API error: ${forecastResponse.status} - ${errorText}`);
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods;

    console.log(`Received ${periods.length} forecast periods`);
    console.log('First period:', JSON.stringify(periods[0], null, 2));

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
    console.log('Current UTC time:', now.toISOString());

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

    console.log('Upserting current weather data:', JSON.stringify(weatherData, null, 2));

    const { data: weatherInsertData, error: weatherError } = await supabase
      .from('weather_data')
      .upsert(weatherData, { onConflict: 'date' })
      .select();

    if (weatherError) {
      console.error('Error storing weather data:', weatherError);
      throw weatherError;
    }

    console.log('Weather data stored successfully:', weatherInsertData);

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
    } else {
      console.log('Old forecasts deleted successfully');
    }

    // Insert new forecasts
    const { data: forecastInsertData, error: forecastError } = await supabase
      .from('weather_forecast')
      .upsert(forecastRecords, { onConflict: 'date,period_name' })
      .select();

    if (forecastError) {
      console.error('Error storing forecast data:', forecastError);
      throw forecastError;
    }

    console.log(`Forecast data stored successfully: ${forecastInsertData?.length || 0} records`);
    console.log('=== FETCH WEATHER DATA COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Weather data updated successfully',
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
