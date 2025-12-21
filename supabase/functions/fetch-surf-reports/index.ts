
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NOAA Buoy 41004 - Edisto, SC (closest to Folly Beach)
const BUOY_ID = '41004';
const FETCH_TIMEOUT = 15000; // 15 seconds

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

    console.log('Fetching surf conditions from NOAA Buoy...');
    console.log('Buoy ID:', BUOY_ID);

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
    const now = new Date();
    const estDateString = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Parse the EST date string (format: MM/DD/YYYY)
    const [eMonth, eDay, eYear] = estDateString.split('/');
    const today = `${eYear}-${eMonth.padStart(2, '0')}-${eDay.padStart(2, '0')}`;
    
    console.log('Current EST date:', today);

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

    // First, check if surf_conditions table exists
    console.log('Checking if surf_conditions table exists...');
    const { error: tableCheckError } = await supabase
      .from('surf_conditions')
      .select('id')
      .limit(1);

    if (tableCheckError) {
      console.error('surf_conditions table does not exist or is not accessible:', tableCheckError);
      console.log('Attempting to create surf_conditions table...');
      
      // Try to create the table
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.surf_conditions (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            date date NOT NULL UNIQUE,
            wave_height text,
            wave_period text,
            swell_direction text,
            wind_speed text,
            wind_direction text,
            water_temp text,
            buoy_id text,
            updated_at timestamptz DEFAULT now(),
            created_at timestamptz DEFAULT now()
          );
          
          ALTER TABLE public.surf_conditions ENABLE ROW LEVEL SECURITY;
          
          DROP POLICY IF EXISTS "Allow public read access to surf_conditions" ON public.surf_conditions;
          CREATE POLICY "Allow public read access to surf_conditions"
            ON public.surf_conditions
            FOR SELECT
            TO public
            USING (true);
          
          DROP POLICY IF EXISTS "Allow service role full access to surf_conditions" ON public.surf_conditions;
          CREATE POLICY "Allow service role full access to surf_conditions"
            ON public.surf_conditions
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
          
          CREATE INDEX IF NOT EXISTS idx_surf_conditions_date ON public.surf_conditions(date DESC);
          
          GRANT SELECT ON public.surf_conditions TO anon, authenticated;
          GRANT ALL ON public.surf_conditions TO service_role;
        `
      });
      
      if (createError) {
        console.error('Failed to create surf_conditions table:', createError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'surf_conditions table does not exist and could not be created',
            details: createError.message,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }
      
      console.log('surf_conditions table created successfully');
    }

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
        message: 'Surf conditions updated successfully',
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
