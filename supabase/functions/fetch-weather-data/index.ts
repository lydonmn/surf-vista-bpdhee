
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

// NOAA Buoy 41004 - Edisto, SC (closest to Folly Beach)
const BUOY_ID = '41004';

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

// Helper function to convert ISO timestamp to EST date string
function getESTDateFromISO(isoString: string): string {
  const date = new Date(isoString);
  const estDateString = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the EST date string (format: MM/DD/YYYY)
  const [month, day, year] = estDateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Helper function to get day name from ISO timestamp in EST
function getDayNameFromISO(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    weekday: 'long'
  });
}

// Helper function to calculate surf height from wave height
function calculateSurfHeight(waveHeightMeters: number, periodSeconds: number): { min: number, max: number, display: string } {
  // Convert to feet first
  const waveHeightFt = waveHeightMeters * 3.28084;
  
  // Surf height multipliers based on wave period
  let multiplierMin = 0.4;
  let multiplierMax = 0.5;
  
  if (periodSeconds >= 12) {
    multiplierMin = 0.6;
    multiplierMax = 0.7;
  } else if (periodSeconds >= 8) {
    multiplierMin = 0.5;
    multiplierMax = 0.6;
  }
  
  const surfHeightMin = waveHeightFt * multiplierMin;
  const surfHeightMax = waveHeightFt * multiplierMax;
  
  // Round to nearest 0.5 ft
  const roundedMin = Math.round(surfHeightMin * 2) / 2;
  const roundedMax = Math.round(surfHeightMax * 2) / 2;
  
  // Ensure surf height never exceeds wave height
  const cappedMin = Math.min(roundedMin, waveHeightFt * 0.95);
  const cappedMax = Math.min(roundedMax, waveHeightFt * 0.95);
  
  // Format display string
  let display: string;
  if (cappedMin === cappedMax) {
    display = `${cappedMin.toFixed(0)}-${(cappedMin + 0.5).toFixed(0)} ft`;
  } else {
    display = `${cappedMin.toFixed(0)}-${cappedMax.toFixed(0)} ft`;
  }
  
  return {
    min: cappedMin,
    max: cappedMax,
    display
  };
}

// Helper function to fetch current buoy data
async function fetchBuoyData(timeout: number = FETCH_TIMEOUT): Promise<{ waveHeight: number, period: number } | null> {
  try {
    const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${BUOY_ID}.txt`;
    console.log('Fetching buoy data for swell predictions:', buoyUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(buoyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Buoy API error:', response.status);
      return null;
    }

    const buoyText = await response.text();
    const lines = buoyText.trim().split('\n');

    if (lines.length < 3) {
      console.error('Insufficient buoy data');
      return null;
    }

    // Parse the most recent data line
    const dataLine = lines[2].trim().split(/\s+/);
    const waveHeight = parseFloat(dataLine[8]); // WVHT in meters
    const dominantPeriod = parseFloat(dataLine[9]); // DPD in seconds

    if (waveHeight === 99.0 || isNaN(waveHeight) || dominantPeriod === 99.0 || isNaN(dominantPeriod)) {
      console.log('Invalid buoy data (missing values)');
      return null;
    }

    console.log('Buoy data retrieved:', { waveHeight, dominantPeriod });
    return { waveHeight, period: dominantPeriod };
  } catch (error) {
    console.error('Error fetching buoy data:', error);
    return null;
  }
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
    
    // Use service role key for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching weather data from NOAA for Folly Beach, SC...');
    console.log('Coordinates:', { lat: FOLLY_BEACH_LAT, lon: FOLLY_BEACH_LON });

    // Get current date in EST
    const today = getESTDate();
    console.log('Current EST date:', today);

    // Fetch current surf conditions from database for today
    const { data: currentSurfConditions, error: surfCondError } = await supabase
      .from('surf_conditions')
      .select('surf_height, wave_height, wave_period')
      .eq('date', today)
      .maybeSingle();

    if (surfCondError) {
      console.error('Error fetching current surf conditions:', surfCondError);
    }

    console.log('Current surf conditions from database:', currentSurfConditions);

    // Determine default swell range for forecasts
    let defaultSwellRange = '1-2 ft';
    let currentSwellRange = '1-2 ft';
    
    // Use actual surf conditions from database if available
    if (currentSurfConditions?.surf_height) {
      currentSwellRange = currentSurfConditions.surf_height;
      console.log('Using current surf height from database for today:', currentSwellRange);
    }

    // Fetch buoy data for future predictions
    const buoyData = await fetchBuoyData();
    
    if (buoyData) {
      const surfCalc = calculateSurfHeight(buoyData.waveHeight, buoyData.period);
      defaultSwellRange = surfCalc.display;
      console.log('Using current buoy data for future swell predictions:', defaultSwellRange);
      
      // If we don't have database surf conditions, use the buoy calculation for today
      if (!currentSurfConditions?.surf_height) {
        currentSwellRange = defaultSwellRange;
        console.log('No database surf conditions, using buoy calculation for today:', currentSwellRange);
      }
    } else {
      console.log('Using default swell range for predictions:', defaultSwellRange);
    }

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

    // Step 4: Store 7-day forecast with aggregated daily data and swell predictions
    // Group periods by date and aggregate high/low temps
    const dailyForecasts = new Map<string, any>();
    
    for (let i = 0; i < Math.min(periods.length, 14); i++) {
      const period = periods[i];
      
      // Parse the start time to get the date in EST using our helper function
      const formattedDate = getESTDateFromISO(period.startTime);
      const dayName = getDayNameFromISO(period.startTime);
      
      console.log(`Processing period ${i}: ${period.name}, startTime: ${period.startTime}, EST date: ${formattedDate}, day: ${dayName}`);
      
      // Get or create daily forecast entry
      if (!dailyForecasts.has(formattedDate)) {
        // Determine swell range for this date
        let swellRange = defaultSwellRange;
        
        // Use actual current surf conditions for today
        if (formattedDate === today) {
          swellRange = currentSwellRange;
          console.log(`Using actual current surf conditions for today (${formattedDate}): ${swellRange}`);
        } else if (buoyData) {
          // Add slight variation for future days (±0.5 ft)
          const dayOffset = i / 2; // Days from now
          const variation = (Math.random() - 0.5) * 1.0; // -0.5 to +0.5 ft
          const adjustedWaveHeight = buoyData.waveHeight + (variation * 0.3048); // Convert ft to meters
          const surfCalc = calculateSurfHeight(Math.max(0.5, adjustedWaveHeight), buoyData.period);
          swellRange = surfCalc.display;
        }
        
        // Parse swell range to get min/max values
        let swellMin = 1;
        let swellMax = 2;
        if (swellRange.includes('-')) {
          const parts = swellRange.split('-');
          swellMin = parseFloat(parts[0]);
          swellMax = parseFloat(parts[1].replace(' ft', ''));
        }
        
        dailyForecasts.set(formattedDate, {
          date: formattedDate,
          day_name: dayName,
          high_temp: null,
          low_temp: null,
          conditions: period.shortForecast,
          icon: period.icon,
          wind_speed: parseInt(period.windSpeed.split(' ')[0]) || 0,
          wind_direction: period.windDirection,
          precipitation_chance: period.probabilityOfPrecipitation?.value || 0,
          humidity: 0,
          swell_height_min: swellMin,
          swell_height_max: swellMax,
          swell_height_range: swellRange,
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
      }
    }

    // Ensure all entries have both high and low temps by filling in missing values
    const forecastRecords = Array.from(dailyForecasts.values()).map(record => {
      // If we're missing low_temp, estimate it as high_temp - 10
      if (record.low_temp === null && record.high_temp !== null) {
        record.low_temp = record.high_temp - 10;
        console.log(`Estimated low_temp for ${record.date}: ${record.low_temp}`);
      }
      // If we're missing high_temp, estimate it as low_temp + 10
      if (record.high_temp === null && record.low_temp !== null) {
        record.high_temp = record.low_temp + 10;
        console.log(`Estimated high_temp for ${record.date}: ${record.high_temp}`);
      }
      // If both are missing, use reasonable defaults
      if (record.high_temp === null && record.low_temp === null) {
        record.high_temp = 65;
        record.low_temp = 55;
        console.log(`Using default temps for ${record.date}`);
      }
      return record;
    });

    console.log(`Prepared ${forecastRecords.length} daily forecast records with swell predictions`);
    console.log('Forecast dates:', forecastRecords.map(r => `${r.date} (${r.day_name}) - Swell: ${r.swell_height_range}`).join(', '));

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
        forecast_dates: forecastRecords.map(r => r.date),
        swell_predictions: forecastRecords.map(r => ({ date: r.date, swell: r.swell_height_range })),
        current_surf_conditions: currentSwellRange,
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
