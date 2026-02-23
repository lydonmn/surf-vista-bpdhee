
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT = 45000; // Increased to 45 seconds for slow NOAA servers

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
    display = `${cappedMin.toFixed(1)} ft`;
  } else {
    display = `${cappedMin.toFixed(1)}-${cappedMax.toFixed(1)} ft`;
  }
  
  return {
    min: cappedMin,
    max: cappedMax,
    display
  };
}

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT, retries: number = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`[Attempt ${attempt}/${retries}] Fetching ${url}`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      console.log(`[Attempt ${attempt}/${retries}] Response status: ${response.status}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[Attempt ${attempt}/${retries}] Request timeout after ${timeout}ms`);
      } else {
        console.error(`[Attempt ${attempt}/${retries}] Fetch error:`, error);
      }
      
      if (attempt < retries) {
        const delayMs = 2000 * attempt; // Progressive delay: 2s, 4s, 6s, 8s, 10s
        console.log(`[Attempt ${attempt}/${retries}] Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

function getDirectionFromDegrees(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  const degreesValue = Math.round(degrees);
  const result = `${directions[index]} (${degreesValue}°)`;
  return result
    .replace(/feet/gi, '')
    .replace(/ft/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 🚨 CRITICAL FIX: Helper to find most recent VALID data from current day
async function getMostRecentValidDataFromToday(
  supabase: any,
  locationId: string,
  today: string
): Promise<any | null> {
  console.log(`🔍 Searching for most recent valid data from today (${today}) for location ${locationId}`);
  
  // Fetch all entries from today, ordered by updated_at descending
  const { data: todayData, error } = await supabase
    .from('surf_conditions')
    .select('*')
    .eq('location', locationId)
    .eq('date', today)
    .order('updated_at', { ascending: false })
    .limit(20); // Get last 20 entries from today (covers all hourly updates)

  if (error) {
    console.error('Error fetching today\'s data:', error);
    return null;
  }

  if (!todayData || todayData.length === 0) {
    console.log('❌ No data found for today');
    return null;
  }

  console.log(`📊 Found ${todayData.length} entries from today, checking for valid wave data...`);

  // Find the most recent entry with valid wave data
  for (const entry of todayData) {
    const waveHeightStr = entry.wave_height;
    const wavePeriodStr = entry.wave_period;
    
    // Check if wave_height AND wave_period are both valid (not N/A, not null, not 99.0 ft)
    if (waveHeightStr && waveHeightStr !== 'N/A' && wavePeriodStr && wavePeriodStr !== 'N/A') {
      const waveHeightValue = parseFloat(waveHeightStr);
      const wavePeriodValue = parseFloat(wavePeriodStr);
      
      if (!isNaN(waveHeightValue) && waveHeightValue < 99.0 && !isNaN(wavePeriodValue) && wavePeriodValue > 0) {
        console.log(`✅ Found valid data from ${entry.updated_at}:`);
        console.log(`   wave_height=${waveHeightStr}, wave_period=${wavePeriodStr}, surf_height=${entry.surf_height}`);
        return entry;
      }
    }
  }

  console.log('❌ No valid wave data found in any of today\'s entries');
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH SURF REPORTS STARTED ===');
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
          status: 200,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Fetch location configuration from database
    console.log('Fetching location configuration from database for:', locationId);
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (locationError || !locationData) {
      console.error('Location not found in database:', locationId, locationError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Location not found: ${locationId}`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('Using location from database:', {
      id: locationData.id,
      name: locationData.display_name,
      buoyId: locationData.buoy_id,
      waterTempStationId: locationData.water_temp_station_id,
    });

    const today = getESTDate();

    // 🚨 CRITICAL FIX: Get most recent VALID data from today BEFORE fetching new data
    const previousValidData = await getMostRecentValidDataFromToday(supabase, locationId, today);

    if (previousValidData) {
      console.log(`📌 Previous valid data available from ${previousValidData.updated_at}`);
      console.log(`   Previous: wave_height=${previousValidData.wave_height}, surf_height=${previousValidData.surf_height}`);
    } else {
      console.log('📌 No previous valid data from today');
    }

    console.log(`Fetching surf conditions from NOAA Buoy ${locationData.buoy_id} for ${locationData.display_name}...`);

    const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${locationData.buoy_id}.txt`;
    console.log('Buoy URL:', buoyUrl);

    let buoyResponse;
    try {
      buoyResponse = await fetchWithTimeout(buoyUrl);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
      console.error('Failed to fetch buoy data after all retries:', errorMsg);
      
      // 🚨 CRITICAL: If we have previous valid data from today, keep it
      if (previousValidData) {
        console.log(`✅ Retaining previous valid data from today due to fetch failure`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Retained previous valid data from today - buoy temporarily unavailable`,
            location: locationData.display_name,
            locationId: locationId,
            buoyId: locationData.buoy_id,
            dataRetained: true,
            retainedFrom: previousValidData.updated_at,
            data: previousValidData,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch buoy data: ${errorMsg}`,
          details: 'NOAA buoy server may be slow or offline. This is a temporary issue with NOAA infrastructure.',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (!buoyResponse.ok) {
      const errorText = await buoyResponse.text();
      console.error('NOAA Buoy API error:', buoyResponse.status, errorText);
      
      // 🚨 CRITICAL: If we have previous valid data from today, keep it
      if (previousValidData) {
        console.log(`✅ Retaining previous valid data from today due to HTTP error`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Retained previous valid data from today - buoy returned error`,
            location: locationData.display_name,
            locationId: locationId,
            buoyId: locationData.buoy_id,
            dataRetained: true,
            retainedFrom: previousValidData.updated_at,
            data: previousValidData,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `NOAA Buoy API returned ${buoyResponse.status}`,
          details: errorText.substring(0, 200),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const buoyText = await buoyResponse.text();
    const lines = buoyText.trim().split('\n');

    console.log(`Received ${lines.length} lines from buoy ${locationData.buoy_id}`);

    if (lines.length < 3) {
      console.error('Insufficient buoy data - need at least 3 lines');
      
      // 🚨 CRITICAL: If we have previous valid data from today, keep it
      if (previousValidData) {
        console.log(`✅ Retaining previous valid data from today due to insufficient data`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Retained previous valid data from today - insufficient new data`,
            location: locationData.display_name,
            locationId: locationId,
            buoyId: locationData.buoy_id,
            dataRetained: true,
            retainedFrom: previousValidData.updated_at,
            data: previousValidData,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient buoy data received',
          details: `Buoy ${locationData.buoy_id} returned only ${lines.length} lines`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const dataLine = lines[2].trim().split(/\s+/);
    console.log('Data line field count:', dataLine.length);
    
    if (dataLine.length < 15) {
      console.error(`Insufficient fields in data line. Expected at least 15, got ${dataLine.length}`);
      
      // 🚨 CRITICAL: If we have previous valid data from today, keep it
      if (previousValidData) {
        console.log(`✅ Retaining previous valid data from today due to incomplete fields`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Retained previous valid data from today - incomplete new data`,
            location: locationData.display_name,
            locationId: locationId,
            buoyId: locationData.buoy_id,
            dataRetained: true,
            retainedFrom: previousValidData.updated_at,
            data: previousValidData,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Incomplete buoy data from buoy ${locationData.buoy_id}`,
          details: `Expected at least 15 fields, got ${dataLine.length}. Buoy may be in maintenance or experiencing sensor issues.`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    // Parse buoy data fields
    const waveHeight = parseFloat(dataLine[8]);      // WVHT - Wave Height (meters)
    const dominantPeriod = parseFloat(dataLine[9]);  // DPD - Dominant Wave Period (seconds)
    const meanWaveDirection = parseFloat(dataLine[11]); // MWD - Mean Wave Direction (degrees)
    const windDirection = parseFloat(dataLine[5]);   // WDIR - Wind Direction (degrees)
    const windSpeed = parseFloat(dataLine[6]);       // WSPD - Wind Speed (m/s)
    const waterTemp = parseFloat(dataLine[14]);      // WTMP - Water Temperature (Celsius)
    
    console.log('Parsed raw values from buoy:', {
      waveHeight,
      dominantPeriod,
      meanWaveDirection,
      windDirection,
      windSpeed,
      waterTemp
    });
    
    // Check data validity
    const hasWaveData = waveHeight !== 99.0 && !isNaN(waveHeight) && waveHeight > 0;
    const hasPeriodData = dominantPeriod !== 99.0 && !isNaN(dominantPeriod) && dominantPeriod > 0;
    const hasWindData = windSpeed !== 99.0 && !isNaN(windSpeed);
    const hasWaterTemp = waterTemp !== 999.0 && !isNaN(waterTemp);
    
    console.log('Data validity check:', {
      hasWaveData,
      hasPeriodData,
      hasWindData,
      hasWaterTemp
    });
    
    // 🚨 CRITICAL FIX: If new data is incomplete, revert to most recent valid data from TODAY
    const hasMinimalValidData = hasWaveData && hasPeriodData;
    
    if (!hasMinimalValidData && previousValidData) {
      console.log(`⚠️ New data incomplete for ${locationData.display_name} - reverting to previous valid data from today`);
      console.log(`📅 Using data from ${previousValidData.updated_at} (earlier today)`);
      console.log('Previous valid data will continue to be displayed until next valid update');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Retained previous valid data from today (${previousValidData.updated_at})`,
          location: locationData.display_name,
          locationId: locationId,
          buoyId: locationData.buoy_id,
          dataRetained: true,
          retainedFrom: previousValidData.updated_at,
          data: previousValidData,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Convert to imperial units and format
    const waveHeightFt = hasWaveData
      ? (waveHeight * 3.28084).toFixed(1)
      : 'N/A';
    
    let surfHeight = 'N/A';
    if (hasWaveData && hasPeriodData) {
      const surfHeightCalc = calculateSurfHeight(waveHeight, dominantPeriod);
      surfHeight = surfHeightCalc.display;
      console.log('Calculated surf height:', surfHeight);
    }
    
    const wavePeriodSec = hasPeriodData
      ? dominantPeriod.toFixed(0)
      : 'N/A';
    
    const swellDirection = meanWaveDirection !== 999.0 && !isNaN(meanWaveDirection)
      ? getDirectionFromDegrees(meanWaveDirection)
      : 'N/A';
    
    const windDir = windDirection !== 999.0 && !isNaN(windDirection)
      ? getDirectionFromDegrees(windDirection)
          .replace(/feet/gi, '')
          .replace(/ft/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
      : 'N/A';
    
    const windSpeedMph = hasWindData
      ? (windSpeed * 2.23694).toFixed(0)
      : 'N/A';
    
    // Fetch water temperature from specific station if configured
    let waterTempF = 'N/A';
    
    if (locationData.water_temp_station_id && locationData.water_temp_station_id !== locationData.buoy_id) {
      console.log(`Fetching water temperature from station ${locationData.water_temp_station_id}`);
      
      try {
        const waterTempStationUrl = `https://www.ndbc.noaa.gov/data/realtime2/${locationData.water_temp_station_id}.txt`;
        const waterTempResponse = await fetchWithTimeout(waterTempStationUrl);
        
        if (waterTempResponse.ok) {
          const waterTempText = await waterTempResponse.text();
          const waterTempLines = waterTempText.trim().split('\n');
          
          if (waterTempLines.length >= 3) {
            const waterTempDataLine = waterTempLines[2].trim().split(/\s+/);
            
            if (waterTempDataLine.length >= 15) {
              const stationWaterTemp = parseFloat(waterTempDataLine[14]);
              
              if (stationWaterTemp !== 999.0 && !isNaN(stationWaterTemp)) {
                waterTempF = ((stationWaterTemp * 9/5) + 32).toFixed(0);
                console.log(`✅ Water temperature from station ${locationData.water_temp_station_id}: ${waterTempF}°F`);
              } else {
                console.log(`⚠️ Water temp station reporting invalid data, falling back to primary buoy`);
                if (hasWaterTemp) {
                  waterTempF = ((waterTemp * 9/5) + 32).toFixed(0);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching water temp from station:`, error);
        if (hasWaterTemp) {
          waterTempF = ((waterTemp * 9/5) + 32).toFixed(0);
        }
      }
    } else {
      if (hasWaterTemp) {
        waterTempF = ((waterTemp * 9/5) + 32).toFixed(0);
        console.log(`Using water temperature from primary buoy: ${waterTempF}°F`);
      }
    }

    const surfData = {
      date: today,
      location: locationId,
      wave_height: waveHeightFt !== 'N/A' ? `${waveHeightFt} ft` : 'N/A',
      surf_height: surfHeight,
      wave_period: wavePeriodSec !== 'N/A' ? `${wavePeriodSec} sec` : 'N/A',
      swell_direction: swellDirection,
      wind_speed: windSpeedMph !== 'N/A' ? `${windSpeedMph} mph` : 'N/A',
      wind_direction: windDir,
      water_temp: waterTempF !== 'N/A' ? `${waterTempF}°F` : 'N/A',
      buoy_id: locationData.buoy_id,
      updated_at: new Date().toISOString(),
    };

    console.log('Storing NEW VALID surf data:', surfData);

    const { data: insertData, error: surfError } = await supabase
      .from('surf_conditions')
      .upsert(surfData, { onConflict: 'date,location' })
      .select();

    if (surfError) {
      console.error('Error storing surf data:', surfError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store surf data in database',
          details: surfError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('✅ NEW VALID surf data stored successfully');
    console.log('=== FETCH SURF REPORTS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Surf conditions updated successfully for ${locationData.display_name}`,
        location: locationData.display_name,
        locationId: locationId,
        buoyId: locationData.buoy_id,
        data: surfData,
        dataQuality: {
          hasWaveData,
          hasPeriodData,
          hasWindData,
          hasWaterTemp,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH SURF REPORTS FAILED ===');
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
