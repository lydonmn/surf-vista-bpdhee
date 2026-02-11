
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
  return `${directions[index]} (${degrees.toFixed(0)}°)`;
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

    // 🔥 DYNAMIC: Fetch location configuration from database
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
    });

    console.log(`Fetching surf conditions from NOAA Buoy ${locationData.buoy_id} for ${locationData.display_name}...`);

    const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${locationData.buoy_id}.txt`;
    console.log('Buoy URL:', buoyUrl);

    let buoyResponse;
    try {
      buoyResponse = await fetchWithTimeout(buoyUrl);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
      console.error('Failed to fetch buoy data after all retries:', errorMsg);
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
    console.log('First 5 lines of buoy data:');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      console.log(`Line ${i}: ${lines[i]}`);
    }

    if (lines.length < 3) {
      console.error('Insufficient buoy data - need at least 3 lines');
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
    console.log('Data line split into fields:', dataLine);
    console.log('Field count:', dataLine.length);
    console.log('Expected fields: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE');
    
    // IMPROVED: Validate field count before parsing
    if (dataLine.length < 15) {
      console.error(`Insufficient fields in data line. Expected at least 15, got ${dataLine.length}`);
      console.error('Data line:', lines[2]);
      console.error('This usually means the buoy is reporting partial data or is in maintenance mode');
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
    
    // IMPROVED: Check if we have at least SOME valid data (not all 99.0 or 999.0)
    const hasWaveData = waveHeight !== 99.0 && !isNaN(waveHeight);
    const hasPeriodData = dominantPeriod !== 99.0 && !isNaN(dominantPeriod);
    const hasWindData = windSpeed !== 99.0 && !isNaN(windSpeed);
    const hasWaterTemp = waterTemp !== 999.0 && !isNaN(waterTemp);
    
    console.log('Data validity check:', {
      hasWaveData,
      hasPeriodData,
      hasWindData,
      hasWaterTemp
    });
    
    const hasAnyValidData = hasWaveData || hasPeriodData || hasWindData || hasWaterTemp;
    
    if (!hasAnyValidData) {
      console.warn(`⚠️ All sensors on buoy ${locationData.buoy_id} reporting invalid data (99.0/999.0)`);
      console.warn('This indicates the buoy is offline, in maintenance, or experiencing sensor failures');
      console.warn('Will store N/A values - the narrative generator will create an appropriate message');
    } else {
      console.log(`✅ Buoy ${locationData.buoy_id} has at least some valid sensor data`);
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
    } else {
      console.log('Cannot calculate surf height - missing wave height or period data');
    }
    
    const wavePeriodSec = hasPeriodData
      ? dominantPeriod.toFixed(0)
      : 'N/A';
    
    const swellDirection = meanWaveDirection !== 999.0 && !isNaN(meanWaveDirection)
      ? getDirectionFromDegrees(meanWaveDirection)
      : 'N/A';
    
    const windDir = windDirection !== 999.0 && !isNaN(windDirection)
      ? getDirectionFromDegrees(windDirection)
      : 'N/A';
    
    const windSpeedMph = hasWindData
      ? (windSpeed * 2.23694).toFixed(0)
      : 'N/A';
    
    const waterTempF = hasWaterTemp
      ? ((waterTemp * 9/5) + 32).toFixed(0)
      : 'N/A';

    const today = getESTDate();

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

    console.log('Storing surf data:', surfData);

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

    console.log('Surf data stored successfully');
    console.log('=== FETCH SURF REPORTS COMPLETED ===');

    // Provide helpful feedback about data quality
    let dataQualityMessage = '';
    if (!hasWaveData && !hasPeriodData) {
      dataQualityMessage = ` Note: Wave sensors on buoy ${locationData.buoy_id} are currently offline or reporting invalid data. Wind and water temperature data is still available.`;
    } else if (!hasWaveData) {
      dataQualityMessage = ` Note: Wave height sensor on buoy ${locationData.buoy_id} is offline.`;
    } else if (!hasPeriodData) {
      dataQualityMessage = ` Note: Wave period sensor on buoy ${locationData.buoy_id} is offline.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Surf conditions updated successfully for ${locationData.display_name}.${dataQualityMessage}`,
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
