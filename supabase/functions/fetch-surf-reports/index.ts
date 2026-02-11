
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT = 30000; // Increased to 30 seconds

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

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT, retries: number = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`Fetching ${url} (attempt ${attempt}/${retries})`);
      const response = await fetch(url, { signal: controller.signal });
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
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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

    console.log(`Fetching surf conditions from NOAA Buoy for ${locationData.display_name}...`);

    const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${locationData.buoy_id}.txt`;

    let buoyResponse;
    try {
      buoyResponse = await fetchWithTimeout(buoyUrl);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
      console.error('Failed to fetch buoy data:', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch buoy data: ${errorMsg}`,
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
          error: `NOAA Buoy API error: ${buoyResponse.status}`,
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

    console.log(`Received ${lines.length} lines from buoy`);
    console.log('First 5 lines of buoy data:');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      console.log(`Line ${i}: ${lines[i]}`);
    }

    if (lines.length < 3) {
      console.error('Insufficient buoy data');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient buoy data received',
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
    
    // IMPROVED: Validate field count before parsing
    if (dataLine.length < 15) {
      console.error(`Insufficient fields in data line. Expected at least 15, got ${dataLine.length}`);
      console.error('Data line:', lines[2]);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Incomplete buoy data: expected at least 15 fields, got ${dataLine.length}`,
          details: 'Buoy may be reporting partial data. Will retry later.',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    const waveHeight = parseFloat(dataLine[8]);
    const dominantPeriod = parseFloat(dataLine[9]);
    const meanWaveDirection = parseFloat(dataLine[11]);
    const windDirection = parseFloat(dataLine[5]);
    const windSpeed = parseFloat(dataLine[6]);
    const waterTemp = parseFloat(dataLine[14]);
    
    console.log('Parsed values:', {
      waveHeight,
      dominantPeriod,
      meanWaveDirection,
      windDirection,
      windSpeed,
      waterTemp
    });
    
    // IMPROVED: Check if we have at least SOME valid data (not all 99.0 or 999.0)
    const hasAnyValidData = (
      (waveHeight !== 99.0 && !isNaN(waveHeight)) ||
      (dominantPeriod !== 99.0 && !isNaN(dominantPeriod)) ||
      (windSpeed !== 99.0 && !isNaN(windSpeed)) ||
      (waterTemp !== 999.0 && !isNaN(waterTemp))
    );
    
    if (!hasAnyValidData) {
      console.warn('All buoy sensors reporting invalid data (99.0/999.0). Buoy may be offline or sensors malfunctioning.');
      // Still continue - we'll store N/A values and the narrative will handle it
    }

    const waveHeightFt = waveHeight !== 99.0 && !isNaN(waveHeight) 
      ? (waveHeight * 3.28084).toFixed(1)
      : 'N/A';
    
    let surfHeight = 'N/A';
    if (waveHeight !== 99.0 && !isNaN(waveHeight) && dominantPeriod !== 99.0 && !isNaN(dominantPeriod)) {
      const surfHeightCalc = calculateSurfHeight(waveHeight, dominantPeriod);
      surfHeight = surfHeightCalc.display;
    }
    
    const wavePeriodSec = dominantPeriod !== 99.0 && !isNaN(dominantPeriod)
      ? dominantPeriod.toFixed(0)
      : 'N/A';
    
    const swellDirection = meanWaveDirection !== 999.0 && !isNaN(meanWaveDirection)
      ? getDirectionFromDegrees(meanWaveDirection)
      : 'N/A';
    
    const windDir = windDirection !== 999.0 && !isNaN(windDirection)
      ? getDirectionFromDegrees(windDirection)
      : 'N/A';
    
    const windSpeedMph = windSpeed !== 99.0 && !isNaN(windSpeed)
      ? (windSpeed * 2.23694).toFixed(0)
      : 'N/A';
    
    const waterTempF = waterTemp !== 999.0 && !isNaN(waterTemp)
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

    console.log('=== FETCH SURF REPORTS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Surf conditions updated successfully for ${locationData.display_name}`,
        location: locationData.display_name,
        locationId: locationId,
        data: surfData,
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
