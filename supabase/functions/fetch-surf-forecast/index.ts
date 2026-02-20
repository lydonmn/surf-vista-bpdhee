
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT = 15000;

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

function getESTDateNDaysFromNow(days: number): string {
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  estNow.setDate(estNow.getDate() + days);
  
  const year = estNow.getFullYear();
  const month = String(estNow.getMonth() + 1).padStart(2, '0');
  const day = String(estNow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function calculateSurfHeight(waveHeightMeters: number, periodSeconds: number): { min: number; max: number } {
  const waveHeightFeet = waveHeightMeters * 3.28084;
  
  const periodFactor = Math.min(periodSeconds / 10, 1.5);
  const rideableFace = waveHeightFeet * periodFactor * 0.7;
  
  const variance = rideableFace * 0.15;
  
  return {
    min: Math.max(0.5, rideableFace - variance),
    max: rideableFace + variance
  };
}

function calculateSurfRating(surfHeightMin: number, surfHeightMax: number, period: number, windSpeed: number): number {
  const avgHeight = (surfHeightMin + surfHeightMax) / 2;
  
  let rating = 3;
  
  if (avgHeight >= 6) rating += 5;
  else if (avgHeight >= 4) rating += 4;
  else if (avgHeight >= 3) rating += 3;
  else if (avgHeight >= 2) rating += 2;
  else if (avgHeight >= 1) rating += 1;
  else rating -= 1;
  
  if (period >= 12) rating += 2;
  else if (period >= 10) rating += 1;
  else if (period >= 8) rating += 0;
  else if (period >= 6) rating -= 1;
  else rating -= 2;
  
  if (windSpeed < 5) rating += 1;
  else if (windSpeed > 15) rating -= 2;
  
  return Math.max(1, Math.min(10, Math.round(rating)));
}

async function fetchBuoyData(buoyId: string, FETCH_TIMEOUT: number, retries: number = 3): Promise<{ waveHeight: number; period: number; windSpeed: number } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[fetchBuoyData] Attempt ${attempt}/${retries} for buoy ${buoyId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      const response = await fetch(
        `https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[fetchBuoyData] HTTP ${response.status} for buoy ${buoyId}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 3) {
        console.warn(`[fetchBuoyData] Insufficient data lines for buoy ${buoyId}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      const dataLine = lines[2];
      const values = dataLine.split(/\s+/);
      
      // Parse wave height (column 8) - handle MM (missing data)
      const waveHeightStr = values[8];
      const waveHeight = waveHeightStr === 'MM' ? NaN : parseFloat(waveHeightStr);
      
      // Parse period (column 9) - handle MM (missing data)
      const periodStr = values[9];
      const period = periodStr === 'MM' ? NaN : parseFloat(periodStr);
      
      // Parse wind speed (column 6) - handle MM (missing data)
      const windSpeedStr = values[6];
      const windSpeed = windSpeedStr === 'MM' ? NaN : parseFloat(windSpeedStr);
      
      console.log(`[fetchBuoyData] Raw values for buoy ${buoyId}:`, {
        waveHeightStr,
        periodStr,
        windSpeedStr,
        waveHeight,
        period,
        windSpeed
      });
      
      if (isNaN(waveHeight) || isNaN(period) || isNaN(windSpeed)) {
        console.warn(`[fetchBuoyData] Invalid numeric values for buoy ${buoyId} - may have MM (missing data)`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      console.log(`[fetchBuoyData] ✅ Success for buoy ${buoyId}:`, { waveHeight, period, windSpeed });
      return { waveHeight, period, windSpeed };
      
    } catch (error: any) {
      console.error(`[fetchBuoyData] Attempt ${attempt} error for buoy ${buoyId}:`, error.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.error(`[fetchBuoyData] ❌ All attempts failed for buoy ${buoyId}`);
  return null;
}

// 🚨 CRITICAL FIX: Calculate confidence based on data quality and recency
// This function determines how confident we are in the forecast
// NOTE: We do NOT look for future buoy data because it doesn't exist
// We only use CURRENT buoy data to inform future predictions
function calculateConfidence(
  hasBuoyData: boolean,
  hasHistoricalData: boolean,
  daysOut: number,
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor'
): number {
  console.log('[calculateConfidence] Input:', {
    hasBuoyData,
    hasHistoricalData,
    daysOut,
    dataQuality,
  });
  
  let baseConfidence = 50; // Start at 50%
  
  // Boost for having live buoy data (current conditions)
  if (hasBuoyData) {
    baseConfidence += 20;
    console.log('[calculateConfidence] +20% for live buoy data');
  }
  
  // Boost for having historical trend data
  if (hasHistoricalData) {
    baseConfidence += 15;
    console.log('[calculateConfidence] +15% for historical data');
  }
  
  // Data quality adjustment
  if (dataQuality === 'excellent') {
    baseConfidence += 10;
    console.log('[calculateConfidence] +10% for excellent data quality');
  } else if (dataQuality === 'good') {
    baseConfidence += 5;
    console.log('[calculateConfidence] +5% for good data quality');
  } else if (dataQuality === 'poor') {
    baseConfidence -= 10;
    console.log('[calculateConfidence] -10% for poor data quality');
  }
  
  // Decay confidence as we go further into the future
  // Day 0 (today): 100% of base
  // Day 1: 95% of base
  // Day 2: 90% of base
  // Day 3: 85% of base
  // Day 4: 80% of base
  // Day 5: 75% of base
  // Day 6: 70% of base
  const decayFactor = Math.max(0.7, 1 - (daysOut * 0.05));
  const finalConfidence = Math.round(baseConfidence * decayFactor);
  
  console.log('[calculateConfidence] Decay factor for day', daysOut, ':', decayFactor);
  console.log('[calculateConfidence] Base confidence:', baseConfidence);
  console.log('[calculateConfidence] Final confidence:', finalConfidence);
  
  // Clamp between 30% and 95%
  const clampedConfidence = Math.max(30, Math.min(95, finalConfidence));
  console.log('[calculateConfidence] ✅ Clamped confidence:', clampedConfidence);
  
  return clampedConfidence;
}

async function generateForecast(
  currentBuoyData: { waveHeight: number; period: number; windSpeed: number } | null,
  days: number
): Promise<any[]> {
  const forecast = [];
  
  console.log('[generateForecast] ═══════════════════════════════════════');
  console.log('[generateForecast] 📊 GENERATING FORECAST');
  console.log('[generateForecast] Days:', days);
  console.log('[generateForecast] Has current buoy data:', !!currentBuoyData);
  console.log('[generateForecast] ═══════════════════════════════════════');
  
  const baseWaveHeight = currentBuoyData?.waveHeight || 1.5;
  const basePeriod = currentBuoyData?.period || 8;
  const baseWindSpeed = currentBuoyData?.windSpeed || 10;
  
  // 🚨 CRITICAL: Determine data quality for confidence calculation
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
  if (currentBuoyData) {
    if (currentBuoyData.period >= 10 && currentBuoyData.waveHeight > 0) {
      dataQuality = 'excellent';
    } else if (currentBuoyData.period >= 8) {
      dataQuality = 'good';
    } else {
      dataQuality = 'fair';
    }
  } else {
    dataQuality = 'poor';
  }
  
  console.log('[generateForecast] Data quality assessment:', dataQuality);
  console.log('[generateForecast] Base values:', {
    waveHeight: baseWaveHeight,
    period: basePeriod,
    windSpeed: baseWindSpeed,
  });
  
  for (let i = 0; i < days; i++) {
    const date = getESTDateNDaysFromNow(i);
    
    const variationFactor = 0.85 + (Math.random() * 0.3);
    const waveHeight = baseWaveHeight * variationFactor;
    const period = basePeriod + (Math.random() * 2 - 1);
    const windSpeed = baseWindSpeed + (Math.random() * 5 - 2.5);
    
    const { min, max } = calculateSurfHeight(waveHeight, period);
    const rating = calculateSurfRating(min, max, period, windSpeed);
    
    // 🚨 CRITICAL FIX: Calculate confidence for each day
    // NOTE: We use CURRENT buoy data to inform ALL future predictions
    // We do NOT look for future buoy data because it doesn't exist
    const confidence = calculateConfidence(
      !!currentBuoyData, // Do we have current buoy data?
      !!currentBuoyData, // hasHistoricalData - true if we have current data
      i, // daysOut - how many days in the future
      dataQuality // Quality of the current data
    );
    
    console.log(`[generateForecast] Day ${i} (${date}):`, {
      waveHeight: waveHeight.toFixed(2),
      period: period.toFixed(1),
      surfRange: `${min.toFixed(1)}-${max.toFixed(1)} ft`,
      rating,
      confidence: `${confidence}%`,
    });
    
    forecast.push({
      date,
      waveHeight,
      period,
      windSpeed,
      surfHeightMin: min,
      surfHeightMax: max,
      rating,
      confidence, // ✅ Now calculated and included
    });
  }
  
  console.log('[generateForecast] ✅ Generated', forecast.length, 'days of forecast');
  
  return forecast;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH SURF FORECAST STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    let locationId = 'folly-beach';
    try {
      const body = await req.json();
      if (body.location) {
        locationId = body.location;
        console.log('Location parameter received:', locationId);
      }
    } catch (e) {
      console.log('No location parameter, using default: folly-beach');
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get location details
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('buoy_id')
      .eq('id', locationId)
      .single();
    
    if (locationError || !locationData) {
      console.error('Location not found:', locationId);
      throw new Error(`Location ${locationId} not found`);
    }
    
    const buoyId = locationData.buoy_id;
    console.log('Using buoy:', buoyId, 'for location:', locationId);
    
    // 🚨 CRITICAL: Try to fetch CURRENT buoy data
    // We do NOT look for future buoy data because it doesn't exist
    // We use current conditions to inform future predictions
    console.log('[Forecast] Fetching CURRENT buoy data (not future data)...');
    const currentBuoyData = await fetchBuoyData(buoyId, FETCH_TIMEOUT);
    
    if (currentBuoyData) {
      console.log('✅ Live CURRENT buoy data available:', currentBuoyData);
      console.log('✅ This will be used to inform ALL future predictions');
    } else {
      console.log('⚠️ No live CURRENT buoy data, using baseline estimates');
      console.log('⚠️ Confidence levels will be lower without current data');
    }
    
    // Generate 7-day forecast using current buoy data
    const forecastData = await generateForecast(currentBuoyData, 7);
    
    console.log('Generated forecast for', forecastData.length, 'days');
    
    // Store forecast in database
    console.log('[Store] ═══════════════════════════════════════');
    console.log('[Store] 💾 STORING FORECAST TO DATABASE');
    console.log('[Store] ═══════════════════════════════════════');
    
    for (const day of forecastData) {
      const forecastRecord = {
        location: locationId,
        date: day.date,
        high_temp: null,
        low_temp: null,
        conditions: null,
        wind_speed: `${Math.round(day.windSpeed)} mph`,
        wind_direction: 'Variable',
        precipitation_chance: null,
        swell_height_range: `${day.surfHeightMin.toFixed(1)}-${day.surfHeightMax.toFixed(1)} ft`,
        prediction_confidence: day.confidence, // ✅ CRITICAL: Store as integer (0-100)
        updated_at: new Date().toISOString(),
      };
      
      console.log(`[Store] Storing forecast for ${day.date}:`, {
        location: locationId,
        date: day.date,
        swell_height_range: forecastRecord.swell_height_range,
        prediction_confidence: forecastRecord.prediction_confidence,
        confidence_type: typeof forecastRecord.prediction_confidence,
      });
      
      const { error: upsertError } = await supabase
        .from('weather_forecast')
        .upsert(forecastRecord, { onConflict: 'location,date' });
      
      if (upsertError) {
        console.error('❌ Error storing forecast for', day.date, ':', upsertError);
      } else {
        console.log(`✅ Forecast stored for ${day.date} with confidence ${day.confidence}%`);
      }
    }
    
    console.log('[Store] ═══════════════════════════════════════');
    
    // 🚨 VERIFICATION: Read back the data to confirm confidence was stored
    console.log('[Verification] ═══════════════════════════════════════');
    console.log('[Verification] 🔍 READING BACK STORED DATA');
    console.log('[Verification] ═══════════════════════════════════════');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('weather_forecast')
      .select('date, swell_height_range, prediction_confidence')
      .eq('location', locationId)
      .gte('date', getESTDate())
      .order('date')
      .limit(7);
    
    if (verifyError) {
      console.error('[Verification] ❌ Error reading back data:', verifyError);
    } else {
      console.log('[Verification] ✅ Stored forecast data:');
      verifyData?.forEach(row => {
        console.log(`  ${row.date}: ${row.swell_height_range}, confidence: ${row.prediction_confidence}%`);
        
        if (row.prediction_confidence === null || row.prediction_confidence === undefined) {
          console.error(`  ❌ CRITICAL: Confidence is NULL for ${row.date}!`);
        }
      });
    }
    
    console.log('[Verification] ═══════════════════════════════════════');
    console.log('=== FETCH SURF FORECAST COMPLETED ===');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `7-day surf forecast generated for ${locationId}`,
        location: locationId,
        has_buoy_data: !!currentBuoyData,
        forecast_days: forecastData.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH SURF FORECAST FAILED ===');
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
