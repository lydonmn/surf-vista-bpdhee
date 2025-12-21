
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NOAA Buoy 41004 - Edisto, SC (closest to Folly Beach)
const BUOY_ID = '41004';
const FETCH_TIMEOUT = 15000; // 15 seconds

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  // Convert to EST by subtracting 5 hours (EST is UTC-5)
  const estTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  const year = estTime.getUTCFullYear();
  const month = String(estTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(estTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
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
          status: 500,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching surf conditions from NOAA Buoy for Folly Beach, SC...');
    console.log('Buoy ID:', BUOY_ID, '(Edisto, SC - closest to Folly Beach)');

    // Fetch latest buoy data with timeout
    const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${BUOY_ID}.txt`;
    console.log('Fetching buoy data:', buoyUrl);

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
          status: 500,
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
          status: 500,
        }
      );
    }

    const buoyText = await buoyResponse.text();
    const lines = buoyText.trim().split('\n');

    console.log(`Received ${lines.length} lines from buoy`);
    console.log('First 5 lines:', lines.slice(0, 5).join('\n'));

    // Skip header lines (first 2 lines)
    if (lines.length < 3) {
      console.error('Insufficient buoy data');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient buoy data received',
          lines: lines.length,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Parse the most recent data line (line 2, after headers)
    const dataLine = lines[2].trim().split(/\s+/);
    
    console.log('Parsing data line:', dataLine.join(' | '));
    
    // NOAA Buoy data format:
    // YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
    // 0  1  2  3  4  5    6    7   8    9   10  11  12   13   14   15   16  17
    
    const year = parseInt(dataLine[0]);
    const month = parseInt(dataLine[1]);
    const day = parseInt(dataLine[2]);
    const hour = parseInt(dataLine[3]);
    const minute = parseInt(dataLine[4]);
    const waveHeight = parseFloat(dataLine[8]); // WVHT - Significant wave height in meters
    const dominantPeriod = parseFloat(dataLine[9]); // DPD - Dominant wave period in seconds
    const meanWaveDirection = parseFloat(dataLine[11]); // MWD - Mean wave direction in degrees
    const windDirection = parseFloat(dataLine[5]); // WDIR - Wind direction in degrees
    const windSpeed = parseFloat(dataLine[6]); // WSPD - Wind speed in m/s
    const waterTemp = parseFloat(dataLine[14]); // WTMP - Water temperature in Celsius

    console.log('Parsed buoy data:', {
      timestamp: `${year}-${month}-${day} ${hour}:${minute}`,
      waveHeight,
      dominantPeriod,
      meanWaveDirection,
      windDirection,
      windSpeed,
      waterTemp
    });

    // Convert values and handle missing data (999.0 or MM in NOAA data)
    const waveHeightFt = waveHeight !== 99.0 && !isNaN(waveHeight) 
      ? (waveHeight * 3.28084).toFixed(1) // Convert meters to feet
      : 'N/A';
    
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
      ? (windSpeed * 2.23694).toFixed(0) // Convert m/s to mph
      : 'N/A';
    
    const waterTempF = waterTemp !== 999.0 && !isNaN(waterTemp)
      ? ((waterTemp * 9/5) + 32).toFixed(0) // Convert Celsius to Fahrenheit
      : 'N/A';

    // Get current date in EST
    const today = getESTDate();
    console.log('Current EST date:', today);
    console.log('Current UTC time:', new Date().toISOString());

    // Store the raw buoy data
    const surfData = {
      date: today,
      wave_height: waveHeightFt !== 'N/A' ? `${waveHeightFt} ft` : 'N/A',
      wave_period: wavePeriodSec !== 'N/A' ? `${wavePeriodSec} sec` : 'N/A',
      swell_direction: swellDirection,
      wind_speed: windSpeedMph !== 'N/A' ? `${windSpeedMph} mph` : 'N/A',
      wind_direction: windDir,
      water_temp: waterTempF !== 'N/A' ? `${waterTempF}°F` : 'N/A',
      buoy_id: BUOY_ID,
      updated_at: new Date().toISOString(),
    };

    console.log('Storing surf data:', JSON.stringify(surfData, null, 2));

    // Store in surf_conditions table
    const { data: insertData, error: surfError } = await supabase
      .from('surf_conditions')
      .upsert(surfData, { onConflict: 'date' })
      .select();

    if (surfError) {
      console.error('Error storing surf data:', surfError);
      console.error('Error details:', JSON.stringify(surfError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store surf data in database',
          details: surfError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('Surf conditions stored successfully:', insertData);
    console.log('=== FETCH SURF REPORTS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Surf conditions updated successfully for Folly Beach, SC',
        location: 'Folly Beach, SC (Buoy 41004 - Edisto)',
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
    console.error('Error in fetch-surf-reports:', error);
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

function getDirectionFromDegrees(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return `${directions[index]} (${degrees.toFixed(0)}°)`;
}
