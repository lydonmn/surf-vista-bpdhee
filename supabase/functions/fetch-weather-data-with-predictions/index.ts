
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Folly Beach coordinates
const FOLLY_BEACH_LAT = 32.6552;
const FOLLY_BEACH_LON = -79.9403;
const FETCH_TIMEOUT = 15000;
const BUOY_ID = '41004';

function getESTDate(): string {
  const now = new Date();
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = estDateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

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

function getDayNameFromISO(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    weekday: 'long'
  });
}

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

async function fetchBuoyData(timeout: number = FETCH_TIMEOUT): Promise<{ waveHeight: number, period: number } | null> {
  try {
    const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${BUOY_ID}.txt`;
    console.log('Fetching buoy data:', buoyUrl);

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

    const dataLine = lines[2].trim().split(/\s+/);
    const waveHeight = parseFloat(dataLine[8]);
    const dominantPeriod = parseFloat(dataLine[9]);

    if (waveHeight === 99.0 || isNaN(waveHeight) || dominantPeriod === 99.0 || isNaN(dominantPeriod)) {
      console.log('Invalid buoy data');
      return null;
    }

    console.log('Buoy data retrieved:', { waveHeight, dominantPeriod });
    return { waveHeight, period: dominantPeriod };
  } catch (error) {
    console.error('Error fetching buoy data:', error);
    return null;
  }
}

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
    console.log('=== FETCH WEATHER DATA WITH PREDICTIONS STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = getESTDate();
    console.log('Current EST date:', today);

    // Fetch current surf conditions
    const { data: currentSurfConditions, error: surfCondError } = await supabase
      .from('surf_conditions')
      .select('surf_height, wave_height, wave_period')
      .eq('date', today)
      .maybeSingle();

    if (surfCondError) {
      console.error('Error fetching current surf conditions:', surfCondError);
    }

    console.log('Current surf conditions:', currentSurfConditions);

    // Fetch AI predictions
    const { data: predictions, error: predError } = await supabase
      .from('surf_predictions')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(7);

    if (predError) {
      console.error('Error fetching predictions:', predError);
    }

    console.log(`Fetched ${predictions?.length || 0} AI predictions`);

    // Create prediction lookup map
    const predictionMap = new Map();
    if (predictions) {
      for (const pred of predictions) {
        predictionMap.set(pred.date, pred);
      }
    }

    let defaultSwellRange = '1-2 ft';
    let currentSwellRange = '1-2 ft';
    let hasActualSurfData = false;
    
    if (currentSurfConditions?.surf_height) {
      currentSwellRange = currentSurfConditions.surf_height;
      hasActualSurfData = true;
      console.log('✅ Using ACTUAL surf height from database for today:', currentSwellRange);
    }

    const buoyData = await fetchBuoyData();
    
    if (buoyData) {
      const surfCalc = calculateSurfHeight(buoyData.waveHeight, buoyData.period);
      defaultSwellRange = surfCalc.display;
      console.log('Using current buoy data for baseline:', defaultSwellRange);
      
      if (!hasActualSurfData) {
        currentSwellRange = defaultSwellRange;
      }
    }

    const requestHeaders = {
      'User-Agent': 'SurfVista App (contact@surfvista.app)',
      'Accept': 'application/geo+json'
    };

    // Fetch NOAA weather data
    const pointsUrl = `https://api.weather.gov/points/${FOLLY_BEACH_LAT},${FOLLY_BEACH_LON}`;
    console.log('Fetching grid point:', pointsUrl);
    
    const pointsResponse = await fetchWithTimeout(pointsUrl, requestHeaders);

    if (!pointsResponse.ok) {
      throw new Error(`NOAA Points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const forecastUrl = pointsData.properties.forecast;

    console.log('Forecast URL:', forecastUrl);

    const forecastResponse = await fetchWithTimeout(forecastUrl, requestHeaders);

    if (!forecastResponse.ok) {
      throw new Error(`NOAA Forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods;

    console.log(`Received ${periods.length} forecast periods`);

    // Store current weather data
    const currentPeriod = periods[0];
    
    const weatherData = {
      date: today,
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

    console.log('Upserting current weather data');

    const { error: weatherError } = await supabase
      .from('weather_data')
      .upsert(weatherData, { onConflict: 'date' });

    if (weatherError) {
      console.error('Error storing weather data:', weatherError);
      throw weatherError;
    }

    // Build 7-day forecast with AI predictions
    const dailyForecasts = new Map<string, any>();
    
    for (let i = 0; i < Math.min(periods.length, 14); i++) {
      const period = periods[i];
      const formattedDate = getESTDateFromISO(period.startTime);
      const dayName = getDayNameFromISO(period.startTime);
      
      if (!dailyForecasts.has(formattedDate)) {
        let swellRange = defaultSwellRange;
        let swellMin = 1;
        let swellMax = 2;
        let predictionConfidence = null;
        let predictionSource = 'baseline';
        
        // Use actual current conditions for today
        if (formattedDate === today && hasActualSurfData) {
          swellRange = currentSwellRange;
          predictionSource = 'actual';
          console.log(`✅ Using ACTUAL surf for ${formattedDate}: ${swellRange}`);
        } 
        // Use AI prediction if available
        else if (predictionMap.has(formattedDate)) {
          const prediction = predictionMap.get(formattedDate);
          swellMin = prediction.predicted_surf_min;
          swellMax = prediction.predicted_surf_max;
          swellRange = `${swellMin.toFixed(0)}-${swellMax.toFixed(0)} ft`;
          predictionConfidence = prediction.confidence;
          predictionSource = 'ai_prediction';
          console.log(`🤖 Using AI prediction for ${formattedDate}: ${swellRange} (confidence: ${(predictionConfidence * 100).toFixed(0)}%)`);
        }
        // Fallback to buoy-based estimation
        else if (buoyData) {
          const dayOffset = i / 2;
          const variation = (Math.random() - 0.5) * 1.0;
          const adjustedWaveHeight = buoyData.waveHeight + (variation * 0.3048);
          const surfCalc = calculateSurfHeight(Math.max(0.5, adjustedWaveHeight), buoyData.period);
          swellRange = surfCalc.display;
          swellMin = surfCalc.min;
          swellMax = surfCalc.max;
          predictionSource = 'buoy_estimation';
          console.log(`📊 Using buoy estimation for ${formattedDate}: ${swellRange}`);
        }
        
        // Parse swell range if not already set
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
          prediction_confidence: predictionConfidence,
          prediction_source: predictionSource,
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

    // Fill in missing temps
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

    console.log(`Prepared ${forecastRecords.length} daily forecast records with AI predictions`);

    // Delete old forecasts
    await supabase
      .from('weather_forecast')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new forecasts
    const { data: forecastInsertData, error: forecastError } = await supabase
      .from('weather_forecast')
      .insert(forecastRecords)
      .select();

    if (forecastError) {
      console.error('Error storing forecast data:', forecastError);
      throw forecastError;
    }

    console.log(`Forecast data stored: ${forecastInsertData?.length || 0} records`);
    console.log('=== FETCH WEATHER DATA WITH PREDICTIONS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Weather data with AI predictions updated successfully',
        location: 'Folly Beach, SC',
        current: weatherData,
        forecast_periods: forecastRecords.length,
        ai_predictions_used: predictions?.length || 0,
        prediction_sources: forecastRecords.map(r => ({ 
          date: r.date, 
          source: r.prediction_source,
          confidence: r.prediction_confidence 
        })),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH WEATHER DATA WITH PREDICTIONS FAILED ===');
    console.error('Error:', error);
    
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
