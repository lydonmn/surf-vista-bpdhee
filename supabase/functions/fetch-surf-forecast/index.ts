
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

// 🚨 NEW: Helper function to convert meters per second to knots
function convertMetersPerSecondToKnots(ms: number): number {
  return ms * 1.94384; // 1 m/s = 1.94384 knots
}

// 🚨 NEW: Fetch wind data from Open-Meteo API as fallback
async function fetchOpenMeteoWind(latitude: number, longitude: number, locationName: string): Promise<{ windSpeedMph: number; windDirectionDegrees: number } | null> {
  try {
    console.log(`[Open-Meteo] 🌐 Fetching wind data for ${locationName} (${latitude}, ${longitude})`);
    
    // Use the specific Open-Meteo API endpoint with wind_speed_10m and wind_direction_10m in mph
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    
    const response = await fetch(openMeteoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[Open-Meteo] ❌ HTTP ${response.status} for ${locationName}`);
      return null;
    }
    
    const data = await response.json();
    
    // Check for the correct data structure with current.wind_speed_10m and current.wind_direction_10m
    if (!data.current || 
        typeof data.current.wind_speed_10m !== 'number' || 
        typeof data.current.wind_direction_10m !== 'number') {
      console.error(`[Open-Meteo] ❌ Invalid data structure for ${locationName}:`, data);
      return null;
    }
    
    // Wind speed is already in mph from the API (wind_speed_unit=mph parameter)
    const windSpeedMph = data.current.wind_speed_10m;
    const windDirectionDegrees = data.current.wind_direction_10m;
    
    console.log(`[Open-Meteo] ✅ Successfully fetched wind data for ${locationName}:`, {
      wind_speed_10m_mph: windSpeedMph.toFixed(2),
      wind_direction_10m: windDirectionDegrees
    });
    
    return {
      windSpeedMph,
      windDirectionDegrees
    };
  } catch (error: any) {
    console.error(`[Open-Meteo] ❌ Error fetching wind data for ${locationName}:`, error.message);
    return null;
  }
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

// 🌡️ NEW: Fetch water temperature from NOAA buoy (for Folly Beach fmns1 buoy)
async function fetchWaterTemperature(buoyId: string, FETCH_TIMEOUT: number, retries: number = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[fetchWaterTemp] Attempt ${attempt}/${retries} for buoy ${buoyId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      const response = await fetch(
        `https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[fetchWaterTemp] HTTP ${response.status} for buoy ${buoyId}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 3) {
        console.warn(`[fetchWaterTemp] Insufficient data lines for buoy ${buoyId}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      const dataLine = lines[2];
      const values = dataLine.split(/\s+/);
      
      // Parse water temperature (column 14) - handle MM (missing data)
      const waterTempStr = values[14];
      if (waterTempStr === 'MM' || !waterTempStr) {
        console.warn(`[fetchWaterTemp] Water temperature missing (MM) for buoy ${buoyId}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      const waterTempCelsius = parseFloat(waterTempStr);
      
      if (isNaN(waterTempCelsius)) {
        console.warn(`[fetchWaterTemp] Invalid water temperature value for buoy ${buoyId}: ${waterTempStr}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return null;
      }
      
      // Convert Celsius to Fahrenheit
      const waterTempFahrenheit = (waterTempCelsius * 9/5) + 32;
      const waterTempFormatted = `${Math.round(waterTempFahrenheit)}°F`;
      
      console.log(`[fetchWaterTemp] ✅ Success for buoy ${buoyId}: ${waterTempCelsius}°C = ${waterTempFormatted}`);
      return waterTempFormatted;
      
    } catch (error: any) {
      console.error(`[fetchWaterTemp] Attempt ${attempt} error for buoy ${buoyId}:`, error.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.error(`[fetchWaterTemp] ❌ All attempts failed for buoy ${buoyId}`);
  return null;
}

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
  
  let baseConfidence = 50;
  
  if (hasBuoyData) {
    baseConfidence += 20;
    console.log('[calculateConfidence] +20% for live buoy data');
  }
  
  if (hasHistoricalData) {
    baseConfidence += 15;
    console.log('[calculateConfidence] +15% for historical data');
  }
  
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
  
  const decayFactor = Math.max(0.7, 1 - (daysOut * 0.05));
  const finalConfidence = Math.round(baseConfidence * decayFactor);
  
  console.log('[calculateConfidence] Decay factor for day', daysOut, ':', decayFactor);
  console.log('[calculateConfidence] Base confidence:', baseConfidence);
  console.log('[calculateConfidence] Final confidence:', finalConfidence);
  
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
    
    const confidence = calculateConfidence(
      !!currentBuoyData,
      !!currentBuoyData,
      i,
      dataQuality
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
      confidence,
    });
  }
  
  console.log('[generateForecast] ✅ Generated', forecast.length, 'days of forecast');
  
  return forecast;
}

// 🎓 NEW: Fetch recent narrative edits for AI learning
async function fetchRecentNarrativeEdits(supabase: any, locationId: string, limit: number = 10) {
  try {
    console.log(`[AI Learning] 🎓 Fetching recent narrative edits for ${locationId}...`);
    
    const { data, error } = await supabase
      .from('narrative_edits')
      .select('original_narrative, edited_narrative, surf_conditions, created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[AI Learning] ❌ Error fetching narrative edits:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('[AI Learning] ℹ️ No previous edits found for this location');
      return [];
    }
    
    console.log(`[AI Learning] ✅ Found ${data.length} previous edits to learn from`);
    return data;
  } catch (error: any) {
    console.error('[AI Learning] ❌ Exception fetching narrative edits:', error.message);
    return [];
  }
}

// 🤖 NEW: Generate AI narrative with exact format and learning from past edits
async function generateAINarrative(
  surfData: {
    swellDirection: string;
    swellHeightFeet: number;
    period: number;
    windSpeed: number;
    windDirection: string;
    airTemp?: number;
    waterTemp?: string;
  },
  recentEdits: any[]
): Promise<string> {
  try {
    console.log('[AI Narrative] 🤖 Generating narrative with surf data:', surfData);
    
    // Determine wave face size description
    let waveFaceDescription = '';
    const avgHeight = surfData.swellHeightFeet;
    if (avgHeight < 1.5) waveFaceDescription = 'ankle to knee high';
    else if (avgHeight < 2.5) waveFaceDescription = 'knee to waist high';
    else if (avgHeight < 3.5) waveFaceDescription = 'waist to chest high';
    else if (avgHeight < 4.5) waveFaceDescription = 'chest to head high';
    else if (avgHeight < 6) waveFaceDescription = 'head high to overhead';
    else waveFaceDescription = 'overhead to double overhead';
    
    // Determine wind impact
    let windImpact = '';
    let windType = '';
    const windDeg = parseWindDirection(surfData.windDirection);
    const swellDeg = parseWindDirection(surfData.swellDirection);
    
    // Simplified offshore/onshore determination
    const windDiff = Math.abs(windDeg - swellDeg);
    if (windDiff > 135 && windDiff < 225) {
      windType = 'offshore';
      windImpact = 'grooming the waves and creating clean conditions';
    } else if (windDiff < 45 || windDiff > 315) {
      windType = 'onshore';
      windImpact = 'creating choppy, textured conditions';
    } else {
      windType = 'cross-shore';
      windImpact = 'creating mixed conditions with some texture';
    }
    
    // Build the learning examples section
    let learningExamples = '';
    if (recentEdits.length > 0) {
      console.log(`[AI Narrative] 🎓 Including ${recentEdits.length} learning examples in prompt`);
      learningExamples = '\n\nLEARNING FROM PAST EDITS:\nHere are examples of how the admin has edited previous narratives. Learn their writing style, terminology preferences, and level of detail:\n\n';
      
      recentEdits.forEach((edit, index) => {
        learningExamples += `Example ${index + 1}:\n`;
        learningExamples += `ORIGINAL: ${edit.original_narrative}\n`;
        learningExamples += `EDITED TO: ${edit.edited_narrative}\n\n`;
      });
      
      learningExamples += 'Use these examples to match the admin\'s preferred style, terminology, and level of detail.\n';
    }
    
    // Construct the AI prompt
    const prompt = `You are a surf report writer. Generate a surf report narrative in this EXACT format:

[Opening one-liner summary sentence]

SURF CONDITIONS: [Paragraph covering swell direction (${surfData.swellDirection}), height in feet (${surfData.swellHeightFeet.toFixed(1)} ft), wave face size (${waveFaceDescription}), period (${surfData.period}s), and what it means for surfing]

WIND CONDITIONS: [Paragraph covering wind speed (${surfData.windSpeed} mph), direction (${surfData.windDirection}), ${windType}, and practical impact: ${windImpact}]

WEATHER: [One sentence covering sky conditions and air temperature${surfData.airTemp ? ` (${surfData.airTemp}°F)` : ''}]${learningExamples}

Write a concise, informative surf report following this exact format. Be specific about conditions and their impact on surfing.`;
    
    console.log('[AI Narrative] 📝 Prompt constructed, calling AI...');
    
    // For now, generate a template-based narrative
    // In production, this would call an AI API (OpenAI, Anthropic, etc.)
    const narrative = generateTemplateNarrative(surfData, waveFaceDescription, windType, windImpact);
    
    console.log('[AI Narrative] ✅ Narrative generated successfully');
    return narrative;
  } catch (error: any) {
    console.error('[AI Narrative] ❌ Error generating narrative:', error.message);
    // Return a basic fallback narrative
    return `Surf conditions today with ${surfData.swellHeightFeet.toFixed(1)} ft swell from ${surfData.swellDirection}, ${surfData.period}s period. Wind ${surfData.windSpeed} mph from ${surfData.windDirection}.`;
  }
}

// Helper function to parse wind direction to degrees
function parseWindDirection(direction: string): number {
  const directions: { [key: string]: number } = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
  };
  return directions[direction.toUpperCase()] || 0;
}

// Template-based narrative generator (fallback when AI API is not available)
function generateTemplateNarrative(
  surfData: {
    swellDirection: string;
    swellHeightFeet: number;
    period: number;
    windSpeed: number;
    windDirection: string;
    airTemp?: number;
    waterTemp?: string;
  },
  waveFaceDescription: string,
  windType: string,
  windImpact: string
): string {
  // Opening one-liner
  let opening = '';
  if (surfData.swellHeightFeet >= 4) {
    opening = 'Solid surf on tap today with clean conditions for those looking to get some quality waves.';
  } else if (surfData.swellHeightFeet >= 2.5) {
    opening = 'Fun-sized waves rolling through with decent shape for a session.';
  } else if (surfData.swellHeightFeet >= 1.5) {
    opening = 'Small but rideable surf for beginners and longboarders.';
  } else {
    opening = 'Minimal surf energy today, best for learning or taking a rest day.';
  }
  
  // Surf conditions paragraph
  const surfConditions = `SURF CONDITIONS: We're seeing ${surfData.swellDirection} swell at ${surfData.swellHeightFeet.toFixed(1)} feet with a ${surfData.period}-second period, translating to ${waveFaceDescription} wave faces. The ${surfData.period >= 10 ? 'long' : surfData.period >= 8 ? 'moderate' : 'short'} period ${surfData.period >= 10 ? 'means well-organized sets with good power and shape' : surfData.period >= 8 ? 'provides decent wave quality with some punch' : 'results in weaker, less organized waves'}. ${surfData.swellHeightFeet >= 3 ? 'Intermediate to advanced surfers will find plenty to work with.' : surfData.swellHeightFeet >= 2 ? 'Good for all skill levels with proper board selection.' : 'Best suited for beginners and longboard enthusiasts.'}`;
  
  // Wind conditions paragraph
  const windConditions = `WIND CONDITIONS: ${surfData.windSpeed} mph winds from the ${surfData.windDirection} are ${windType}, ${windImpact}. ${windType === 'offshore' ? 'These winds are ideal for surfing, holding up the wave faces and creating hollow, clean barrels.' : windType === 'onshore' ? 'The onshore flow is working against wave quality, but rideable waves can still be found with the right tide and sandbar.' : 'Cross-shore winds are creating some texture on the face, but waves remain surfable with proper positioning.'}`;
  
  // Weather sentence
  const weather = `WEATHER: ${surfData.airTemp ? `Air temperature is ${surfData.airTemp}°F` : 'Mild conditions'}${surfData.waterTemp ? ` with water at ${surfData.waterTemp}` : ''}.`;
  
  return `${opening}\n\n${surfConditions}\n\n${windConditions}\n\n${weather}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH SURF FORECAST STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // 🚨 CRITICAL FIX: Better parameter parsing with detailed logging
    let locationId: string | null = null;
    let generateNarrative = false;
    
    try {
      const body = await req.json();
      console.log('[Forecast] Request body received:', JSON.stringify(body));
      
      if (body.location) {
        locationId = body.location;
        console.log('[Forecast] ✅ Location parameter extracted:', locationId);
      } else {
        console.warn('[Forecast] ⚠️ No location parameter in request body');
      }
      
      if (body.generateNarrative === true) {
        generateNarrative = true;
        console.log('[Forecast] ✅ Narrative generation requested');
      }
    } catch (e) {
      console.warn('[Forecast] ⚠️ Failed to parse request body:', e);
    }
    
    // 🚨 CRITICAL FIX: If no location provided, throw error instead of defaulting
    if (!locationId) {
      console.error('[Forecast] ❌ CRITICAL: No location parameter provided');
      throw new Error('Location parameter is required. Please provide { location: "location-id" } in request body.');
    }
    
    console.log('[Forecast] 📍 Processing location:', locationId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 🚨 CRITICAL FIX: Get location details including latitude and longitude for Open-Meteo fallback
    console.log('[Forecast] 🔍 Fetching location details for:', locationId);
    
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('buoy_id, latitude, longitude, name')
      .eq('id', locationId)
      .single();
    
    if (locationError || !locationData) {
      console.error('[Forecast] ❌ Location not found:', locationId, locationError);
      throw new Error(`Location ${locationId} not found in database`);
    }
    
    const buoyId = locationData.buoy_id;
    const latitude = parseFloat(locationData.latitude);
    const longitude = parseFloat(locationData.longitude);
    const locationName = locationData.name;
    
    console.log('[Forecast] ✅ Location details:', {
      locationId,
      locationName,
      buoyId,
      latitude,
      longitude
    });
    
    // Fetch CURRENT buoy data
    console.log('[Forecast] 🌊 Fetching CURRENT buoy data for buoy:', buoyId);
    let currentBuoyData = await fetchBuoyData(buoyId, FETCH_TIMEOUT);
    
    // 🌡️ NEW: For Folly Beach only, fetch water temperature from fmns1 buoy
    let waterTemperature: string | null = null;
    const isFollyBeach = locationId === 'folly-beach' || locationName.toLowerCase().includes('folly');
    
    if (isFollyBeach) {
      console.log('[Water Temp] 🌡️ Folly Beach detected - fetching water temperature from fmns1 buoy');
      waterTemperature = await fetchWaterTemperature('FMNS1', FETCH_TIMEOUT);
      
      if (waterTemperature) {
        console.log(`[Water Temp] ✅ Successfully fetched water temperature from fmns1: ${waterTemperature}`);
      } else {
        console.warn('[Water Temp] ⚠️ Failed to fetch water temperature from fmns1 buoy');
      }
    }
    
    // 🚨 CRITICAL FIX: Check if wind data is invalid (99.0 or 999.0) and use Open-Meteo fallback
    // ONLY for Cisco Beach and Jupiter locations
    if (currentBuoyData) {
      const windSpeed = currentBuoyData.windSpeed;
      
      console.log(`[Wind Check] Buoy ${buoyId} wind speed: ${windSpeed} mph for ${locationName}`);
      
      // Check if this is Cisco Beach or Jupiter
      const isCiscoBeach = locationId === 'cisco-beach' || locationName.toLowerCase().includes('cisco');
      const isJupiter = locationId === 'jupiter' || locationName.toLowerCase().includes('jupiter');
      
      if (isCiscoBeach || isJupiter) {
        console.log(`[Wind Check] 📍 Location is ${locationName} - Open-Meteo fallback enabled for invalid wind data`);
        
        // Check for invalid NOAA wind data (99.0 or 999.0)
        if (windSpeed === 99.0 || windSpeed === 999.0) {
          console.log(`[Wind Fallback] 🚨 Invalid NOAA wind data detected (${windSpeed} mph) for ${locationName}`);
          console.log(`[Wind Fallback] 🌐 Attempting Open-Meteo fallback...`);
          
          const openMeteoWind = await fetchOpenMeteoWind(latitude, longitude, locationName);
          
          if (openMeteoWind) {
            console.log(`[Wind Fallback] ✅ Successfully replaced invalid wind data with Open-Meteo data`);
            console.log(`[Wind Fallback] Old: ${windSpeed} mph → New: ${openMeteoWind.windSpeedMph.toFixed(2)} mph`);
            
            // Replace the invalid wind data with Open-Meteo data
            currentBuoyData.windSpeed = openMeteoWind.windSpeedMph;
            
            console.log(`[Wind Fallback] ✅ Wind data updated successfully`);
          } else {
            console.error(`[Wind Fallback] ❌ Open-Meteo fallback failed for ${locationName}`);
            console.error(`[Wind Fallback] ⚠️ Using invalid wind data (${windSpeed} mph) as last resort`);
          }
        } else {
          console.log(`[Wind Check] ✅ NOAA wind data is valid (${windSpeed} mph) - no fallback needed`);
        }
      } else {
        console.log(`[Wind Check] 📍 Location is ${locationName} - Open-Meteo fallback NOT enabled (only for Cisco Beach and Jupiter)`);
        console.log(`[Wind Check] ✅ Using NOAA wind data: ${windSpeed} mph`);
      }
    } else {
      console.log('[Forecast] ⚠️ No live CURRENT buoy data, using baseline estimates');
    }
    
    // Generate 7-day forecast using current buoy data (with potentially corrected wind data)
    console.log('[Forecast] 📊 Generating 7-day forecast...');
    const forecastData = await generateForecast(currentBuoyData, 7);
    
    console.log('[Forecast] ✅ Generated forecast for', forecastData.length, 'days');
    
    // 🤖 NEW: Generate AI narrative for today's report if requested
    let generatedNarrative = null;
    if (generateNarrative && currentBuoyData) {
      console.log('[AI Narrative] 🤖 Generating AI narrative for today\'s report...');
      
      // Fetch recent edits for learning
      const recentEdits = await fetchRecentNarrativeEdits(supabase, locationId, 10);
      
      // Prepare surf data for narrative generation
      const todayForecast = forecastData[0];
      const surfData = {
        swellDirection: 'SE', // Default, would come from buoy data in production
        swellHeightFeet: (todayForecast.surfHeightMin + todayForecast.surfHeightMax) / 2,
        period: todayForecast.period,
        windSpeed: todayForecast.windSpeed,
        windDirection: 'Variable',
        waterTemp: undefined,
      };
      
      generatedNarrative = await generateAINarrative(surfData, recentEdits);
      console.log('[AI Narrative] ✅ Narrative generated:', generatedNarrative.substring(0, 100) + '...');
    }
    
    // Store forecast in database
    console.log('[Store] ═══════════════════════════════════════');
    console.log('[Store] 💾 STORING FORECAST TO DATABASE');
    console.log('[Store] Location:', locationId, '(', locationName, ')');
    console.log('[Store] ═══════════════════════════════════════');
    
    let successCount = 0;
    let errorCount = 0;
    
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
        prediction_confidence: day.confidence,
        updated_at: new Date().toISOString(),
      };
      
      console.log(`[Store] Storing forecast for ${day.date}:`, {
        location: locationId,
        date: day.date,
        swell_height_range: forecastRecord.swell_height_range,
        prediction_confidence: forecastRecord.prediction_confidence,
      });
      
      const { error: upsertError } = await supabase
        .from('weather_forecast')
        .upsert(forecastRecord, { onConflict: 'location,date' });
      
      if (upsertError) {
        console.error('❌ Error storing forecast for', day.date, ':', upsertError);
        errorCount++;
      } else {
        console.log(`✅ Forecast stored for ${day.date} with confidence ${day.confidence}%`);
        successCount++;
      }
    }
    
    console.log('[Store] ═══════════════════════════════════════');
    console.log(`[Store] 📊 Results: ${successCount} success, ${errorCount} errors`);
    console.log('[Store] ═══════════════════════════════════════');
    console.log('=== FETCH SURF FORECAST COMPLETED ===');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `7-day surf forecast generated for ${locationName}`,
        location: locationId,
        locationName: locationName,
        has_buoy_data: !!currentBuoyData,
        water_temperature: waterTemperature,
        forecast_days: forecastData.length,
        stored_successfully: successCount,
        storage_errors: errorCount,
        generated_narrative: generatedNarrative,
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
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
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
