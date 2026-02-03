
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT = 30000; // Increased to 30 seconds

// Location-specific configuration
const LOCATION_CONFIG = {
  'folly-beach': {
    name: 'Folly Beach, SC',
    lat: 32.6552,
    lon: -79.9403,
    buoyId: '41004', // Edisto, SC
  },
  'pawleys-island': {
    name: 'Pawleys Island, SC',
    lat: 33.4318,
    lon: -79.1192,
    buoyId: '41013', // Frying Pan Shoals
  },
};

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
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
  const waveHeightFt = waveHeightMeters * 3.28084;
  
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
  
  const roundedMin = Math.round(surfHeightMin * 2) / 2;
  const roundedMax = Math.round(surfHeightMax * 2) / 2;
  
  const cappedMin = Math.min(roundedMin, waveHeightFt * 0.95);
  const cappedMax = Math.min(roundedMax, waveHeightFt * 0.95);
  
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

// Helper function to fetch current buoy data with retry logic
async function fetchBuoyData(buoyId: string, timeout: number = FETCH_TIMEOUT, retries: number = 3): Promise<{ waveHeight: number, period: number } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`;
      console.log(`Fetching buoy data (attempt ${attempt}/${retries}):`, buoyUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(buoyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Buoy API error (attempt ${attempt}):`, response.status);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
        return null;
      }

      const buoyText = await response.text();
      const lines = buoyText.trim().split('\n');

      if (lines.length < 3) {
        console.error('Insufficient buoy data');
        return null;
      }

      const dataLine = lines[2].trim().split(/\s+/);
      const waveHeight = parseFloat(dataLine[8]);
      const dominantPeriod = parseFloat(dataLine[9]);

      if (waveHeight === 99.0 || isNaN(waveHeight) || dominantPeriod === 99.0 || isNaN(dominantPeriod)) {
        console.log('Invalid buoy data (missing values)');
        return null;
      }

      console.log('Buoy data retrieved:', { waveHeight, dominantPeriod });
      return { waveHeight, period: dominantPeriod };
    } catch (error) {
      console.error(`Error fetching buoy data (attempt ${attempt}):`, error);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

// Helper function to fetch with timeout and retry
async function fetchWithTimeout(url: string, headers: Record<string, string>, timeout: number = FETCH_TIMEOUT, retries: number = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`Fetching ${url} (attempt ${attempt}/${retries})`);
      const response = await fetch(url, { 
        headers,
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Request timeout after ${timeout}ms (attempt ${attempt})`);
      } else {
        console.error(`Fetch error (attempt ${attempt}):`, error);
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH WEATHER DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // Parse request body to get location parameter
    let locationId = 'folly-beach'; // Default location
    try {
      const body = await req.json();
      if (body.location) {
        locationId = body.location;
        console.log('Location parameter received:', locationId);
      }
    } catch (e) {
      console.log('No location parameter in request body, using default: folly-beach');
    }

    // Get location configuration
    const locationConfig = LOCATION_CONFIG[locationId as keyof typeof LOCATION_CONFIG];
    if (!locationConfig) {
      console.error('Invalid location:', locationId);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid location: ${locationId}`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('Using location configuration:', locationConfig);
    
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
          status: 200,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Fetching weather data from NOAA for ${locationConfig.name}...`);
    console.log('Coordinates:', { lat: locationConfig.lat, lon: locationConfig.lon });

    const today = getESTDate();
    console.log('Current EST date:', today);

    const { data: currentSurfConditions, error: surfCondError } = await supabase
      .from('surf_conditions')
      .select('surf_height, wave_height, wave_period')
      .eq('date', today)
      .eq('location', locationId)
      .maybeSingle();

    if (surfCondError) {
      console.error('Error fetching current surf conditions:', surfCondError);
    }

    console.log('Current surf conditions from database:', currentSurfConditions);

    let defaultSwellRange = '1-2 ft';
    let currentSwellRange = '1-2 ft';
    let hasActualSurfData = false;
    
    if (currentSurfConditions?.surf_height) {
      currentSwellRange = currentSurfConditions.surf_height;
      hasActualSurfData = true;
      console.log('✅ Using ACTUAL surf height from database for today:', currentSwellRange);
    }

    const buoyData = await fetchBuoyData(locationConfig.buoyId);
    
    if (buoyData) {
      const surfCalc = calculateSurfHeight(buoyData.waveHeight, buoyData.period);
      defaultSwellRange = surfCalc.display;
      console.log('Using current buoy data for future swell predictions:', defaultSwellRange);
      
      if (!hasActualSurfData) {
        currentSwellRange = defaultSwellRange;
        console.log('No database surf conditions, using buoy calculation for today:', currentSwellRange);
      }
    } else {
      console.log('Using default swell range for predictions:', defaultSwellRange);
      if (!hasActualSurfData) {
        console.log('⚠️ WARNING: No actual surf data or buoy data available, using default 1-2 ft');
      }
    }

    const requestHeaders = {
      'User-Agent': 'SurfVista App (contact@surfvista.app)',
      'Accept': 'application/geo+json'
    };

    const pointsUrl = `https://api.weather.gov/points/${locationConfig.lat},${locationConfig.lon}`;
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
          status: 200,
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
          status: 200,
        }
      );
    }

    const pointsData = await pointsResponse.json();
    console.log('Points data received');
    
    const forecastUrl = pointsData.properties.forecast;

    console.log('Forecast URL:', forecastUrl);

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
          status: 200,
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
          status: 200,
        }
      );
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods;

    console.log(`Received ${periods.length} forecast periods`);

    const currentPeriod = periods[0];
    
    const weatherData = {
      date: today,
      location: locationId,
      temperature: currentPeriod.temperature.toString(),
      feels_like: currentPeriod.temperature.toString(),
      humidity: 0,
      wind_speed: currentPeriod.windSpeed.split(' ')[0],
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

    const { data: weatherInsertData, error: weatherError } = await supabase
      .from('weather_data')
      .upsert(weatherData, { onConflict: 'date,location' })
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
          status: 200,
        }
      );
    }

    console.log('Weather data stored successfully');

    const dailyForecasts = new Map<string, any>();
    
    for (let i = 0; i < Math.min(periods.length, 14); i++) {
      const period = periods[i];
      
      const formattedDate = getESTDateFromISO(period.startTime);
      const dayName = getDayNameFromISO(period.startTime);
      
      console.log(`Processing period ${i}: ${period.name}, EST date: ${formattedDate}`);
      
      if (!dailyForecasts.has(formattedDate)) {
        let swellRange = defaultSwellRange;
        
        if (formattedDate === today && hasActualSurfData) {
          swellRange = currentSwellRange;
          console.log(`✅ Using ACTUAL current surf conditions for today (${formattedDate}): ${swellRange}`);
        } else if (formattedDate === today && !hasActualSurfData) {
          swellRange = currentSwellRange;
          console.log(`⚠️ Using estimated surf conditions for today (${formattedDate}): ${swellRange}`);
        } else if (buoyData) {
          const dayOffset = i / 2;
          const variation = (Math.random() - 0.5) * 1.0;
          const adjustedWaveHeight = buoyData.waveHeight + (variation * 0.3048);
          const surfCalc = calculateSurfHeight(Math.max(0.5, adjustedWaveHeight), buoyData.period);
          swellRange = surfCalc.display;
          console.log(`Using buoy-based prediction for ${formattedDate}: ${swellRange}`);
        }
        
        let swellMin = 1;
        let swellMax = 2;
        if (swellRange.includes('-')) {
          const parts = swellRange.split('-');
          swellMin = parseFloat(parts[0]);
          swellMax = parseFloat(parts[1].replace(' ft', ''));
        }
        
        dailyForecasts.set(formattedDate, {
          date: formattedDate,
          location: locationId,
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
      
      if (period.isDaytime) {
        if (dailyData.high_temp === null || period.temperature > dailyData.high_temp) {
          dailyData.high_temp = period.temperature;
        }
      } else {
        if (dailyData.low_temp === null || period.temperature < dailyData.low_temp) {
          dailyData.low_temp = period.temperature;
        }
      }
      
      if (period.isDaytime) {
        dailyData.conditions = period.shortForecast;
        dailyData.icon = period.icon;
      }
    }

    const forecastRecords = Array.from(dailyForecasts.values()).map(record => {
      if (record.low_temp === null && record.high_temp !== null) {
        record.low_temp = record.high_temp - 10;
      }
      if (record.high_temp === null && record.low_temp !== null) {
        record.high_temp = record.low_temp + 10;
      }
      if (record.high_temp === null && record.low_temp === null) {
        record.high_temp = 65;
        record.low_temp = 55;
      }
      return record;
    });

    console.log(`Prepared ${forecastRecords.length} daily forecast records`);

    const { error: deleteError } = await supabase
      .from('weather_forecast')
      .delete()
      .eq('location', locationId);

    if (deleteError) {
      console.error('Error deleting old forecasts:', deleteError);
    }

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
          status: 200,
        }
      );
    }

    console.log('=== FETCH WEATHER DATA COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Weather data updated successfully for ${locationConfig.name}`,
        location: locationConfig.name,
        locationId: locationId,
        current: weatherData,
        forecast_periods: forecastRecords.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH WEATHER DATA FAILED ===');
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
