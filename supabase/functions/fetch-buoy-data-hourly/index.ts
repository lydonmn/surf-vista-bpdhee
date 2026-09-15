
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT = 45000; // 45 seconds for slow NOAA servers

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

function getESTTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
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
        const delayMs = 2000 * attempt;
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

// 🚨 NEW: Helper to find most recent VALID data from current day
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
    
    // Check if wave_height is valid (not N/A, not null, not 99.0 ft)
    if (waveHeightStr && waveHeightStr !== 'N/A') {
      const waveHeightValue = parseFloat(waveHeightStr);
      if (!isNaN(waveHeightValue) && waveHeightValue < 99.0) {
        console.log(`✅ Found valid data from ${entry.updated_at}: wave_height=${waveHeightStr}, surf_height=${entry.surf_height}`);
        return entry;
      }
    }
  }

  console.log('❌ No valid wave data found in any of today\'s entries');
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const currentTime = getESTTime();
    console.log('=== HOURLY BUOY DATA FETCH STARTED ===');
    console.log('EST Time:', currentTime);
    console.log('Purpose: Fetch buoy data at :20 and :50 minute marks');
    
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

    // Fetch all active locations
    const { data: locationsData, error: locationsError } = await supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (locationsError || !locationsData || locationsData.length === 0) {
      console.error('No active locations found:', locationsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active locations found',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Processing ${locationsData.length} location(s):`, locationsData.map(l => l.display_name).join(', '));

    const results = [];
    const today = getESTDate();

    for (const location of locationsData) {
      console.log(`\n=== Processing ${location.display_name} (Buoy ${location.buoy_id}) ===`);
      
      try {
        // 🚨 CRITICAL FIX: Find most recent VALID data from today (not just most recent entry)
        const previousValidData = await getMostRecentValidDataFromToday(supabase, location.id, today);

        if (previousValidData) {
          console.log(`📌 Previous valid data available from ${previousValidData.updated_at}`);
        } else {
          console.log('📌 No previous valid data from today');
        }

        const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${location.buoy_id}.txt`;
        console.log('Fetching from:', buoyUrl);

        let buoyResponse;
        try {
          buoyResponse = await fetchWithTimeout(buoyUrl);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
          console.error(`Failed to fetch buoy ${location.buoy_id}:`, errorMsg);
          
          // If we have previous valid data from today, keep it
          if (previousValidData) {
            console.log(`✅ Retaining previous valid data from today for ${location.display_name} due to fetch failure`);
            results.push({
              success: true,
              location: location.display_name,
              locationId: location.id,
              message: 'Retained previous valid data from today - buoy temporarily unavailable',
              dataRetained: true,
              retainedFrom: previousValidData.updated_at,
            });
            continue;
          }
          
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: errorMsg,
          });
          continue;
        }

        if (!buoyResponse.ok) {
          console.error(`Buoy ${location.buoy_id} returned status ${buoyResponse.status}`);
          
          // Retain previous valid data from today if available
          if (previousValidData) {
            console.log(`✅ Retaining previous valid data from today for ${location.display_name} due to HTTP error`);
            results.push({
              success: true,
              location: location.display_name,
              locationId: location.id,
              message: 'Retained previous valid data from today - buoy returned error',
              dataRetained: true,
              retainedFrom: previousValidData.updated_at,
            });
            continue;
          }
          
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: `Buoy returned ${buoyResponse.status}`,
          });
          continue;
        }

        const buoyText = await buoyResponse.text();
        const lines = buoyText.trim().split('\n');

        console.log(`Received ${lines.length} lines from buoy ${location.buoy_id}`);

        if (lines.length < 3) {
          console.error('Insufficient buoy data');
          
          // Retain previous valid data from today if available
          if (previousValidData) {
            console.log(`✅ Retaining previous valid data from today for ${location.display_name} due to insufficient data`);
            results.push({
              success: true,
              location: location.display_name,
              locationId: location.id,
              message: 'Retained previous valid data from today - insufficient new data',
              dataRetained: true,
              retainedFrom: previousValidData.updated_at,
            });
            continue;
          }
          
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: 'Insufficient buoy data',
          });
          continue;
        }

        // Parse header to find WVHT and WTMP column indices
        const headerLine = lines[0].trim();
        const headerFields = headerLine.split(/\s+/);
        const wvhtIndex = headerFields.indexOf('WVHT');
        const wtmpIndex = headerFields.indexOf('WTMP');
        
        console.log(`Header fields: ${headerFields.join(', ')}`);
        console.log(`WVHT column index: ${wvhtIndex}, WTMP column index: ${wtmpIndex}`);

        // Scan lines 2-10 to find best data lines for WVHT and WTMP separately
        let dataLine: string[] | null = null;
        let wtmpDataLine: string[] | null = null;
        let selectedLineIndex = -1;
        const maxLineToCheck = Math.min(lines.length, 11);

        for (let i = 2; i < maxLineToCheck; i++) {
          const currentLineFields = lines[i].trim().split(/\s+/);
          if (currentLineFields.length < 15) continue;

          const wvhtValue = wvhtIndex !== -1 ? currentLineFields[wvhtIndex] : currentLineFields[8];
          const wtmpValue = wtmpIndex !== -1 ? currentLineFields[wtmpIndex] : currentLineFields[14];

          if (!dataLine && wvhtValue !== 'MM') {
            dataLine = currentLineFields;
            selectedLineIndex = i;
            console.log(`✅ Selected line ${i} for wave data (WVHT=${wvhtValue})`);
          }
          if (!wtmpDataLine && wtmpValue !== 'MM') {
            wtmpDataLine = currentLineFields;
            console.log(`✅ Selected line ${i} for water temp (WTMP=${wtmpValue})`);
          }
          if (dataLine && wtmpDataLine) break;
        }

        // Fallback to line 2 if nothing found
        if (!dataLine) {
          console.warn('⚠️ No valid WVHT found in lines 2-10. Defaulting to line 2.');
          dataLine = lines[2].trim().split(/\s+/);
          selectedLineIndex = 2;
        }
        if (!wtmpDataLine) {
          console.warn('⚠️ No valid WTMP found in lines 2-10. Using same line as wave data.');
          wtmpDataLine = dataLine;
        }

        if (!dataLine) {
          console.error('❌ No valid data line found for parsing buoy data');
          
          // Retain previous valid data from today if available
          if (previousValidData) {
            console.log(`✅ Retaining previous valid data from today for ${location.display_name} due to no valid data line`);
            results.push({
              success: true,
              location: location.display_name,
              locationId: location.id,
              message: 'Retained previous valid data from today - no valid data line',
              dataRetained: true,
              retainedFrom: previousValidData.updated_at,
            });
            continue;
          }
          
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: 'No valid data line found',
          });
          continue;
        }

        console.log(`Using data from line ${selectedLineIndex} with ${dataLine.length} fields`);
        
        if (dataLine.length < 15) {
          console.error(`Incomplete data - expected 15+ fields, got ${dataLine.length}`);
          
          // Retain previous valid data from today if available
          if (previousValidData) {
            console.log(`✅ Retaining previous valid data from today for ${location.display_name} due to incomplete fields`);
            results.push({
              success: true,
              location: location.display_name,
              locationId: location.id,
              message: 'Retained previous valid data from today - incomplete new data',
              dataRetained: true,
              retainedFrom: previousValidData.updated_at,
            });
            continue;
          }
          
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: 'Incomplete buoy data',
          });
          continue;
        }
        
        // Parse buoy data fields — use dynamic column indices where available
        const waveHeight = parseFloat(wvhtIndex !== -1 ? dataLine[wvhtIndex] : dataLine[8]);
        const dominantPeriod = parseFloat(dataLine[9]);
        const meanWaveDirection = parseFloat(dataLine[11]);
        const windDirection = parseFloat(dataLine[5]);
        const windSpeed = parseFloat(dataLine[6]);
        // Use dedicated WTMP line — may differ from wave data line
        const waterTemp = parseFloat(wtmpIndex !== -1 ? wtmpDataLine[wtmpIndex] : wtmpDataLine[14]);
        console.log(`[buoy] WTMP raw value: ${wtmpIndex !== -1 ? wtmpDataLine[wtmpIndex] : wtmpDataLine[14]} → parsed: ${waterTemp}°C`);
        
        console.log('Parsed values:', {
          waveHeight,
          dominantPeriod,
          meanWaveDirection,
          windDirection,
          windSpeed,
          waterTemp
        });
        
        // Check data validity
        const hasWaveData = waveHeight !== 99.0 && !isNaN(waveHeight);
        const hasPeriodData = dominantPeriod !== 99.0 && !isNaN(dominantPeriod);
        const hasWindData = windSpeed !== 99.0 && !isNaN(windSpeed);
        const hasWaterTemp = waterTemp !== 999.0 && !isNaN(waterTemp);
        
        console.log('Data validity:', {
          hasWaveData,
          hasPeriodData,
          hasWindData,
          hasWaterTemp
        });
        
        // 🚨 CRITICAL FIX: If new data is incomplete, revert to most recent valid data from TODAY
        const hasMinimalValidData = hasWaveData && hasPeriodData;
        
        if (!hasMinimalValidData && previousValidData) {
          console.log(`⚠️ New data incomplete for ${location.display_name} - reverting to previous valid data from today`);
          console.log(`📅 Using data from ${previousValidData.updated_at} (earlier today)`);
          console.log('Previous valid data will continue to be displayed until next valid update');
          
          results.push({
            success: true,
            location: location.display_name,
            locationId: location.id,
            message: `Retained previous valid data from today (${previousValidData.updated_at})`,
            dataRetained: true,
            retainedFrom: previousValidData.updated_at,
          });
          continue;
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
        
        const waterTempF = hasWaterTemp
          ? ((waterTemp * 9/5) + 32).toFixed(0)
          : 'N/A';

        const surfData = {
          date: today,
          location: location.id,
          wave_height: waveHeightFt !== 'N/A' ? `${waveHeightFt} ft` : 'N/A',
          surf_height: surfHeight,
          wave_period: wavePeriodSec !== 'N/A' ? `${wavePeriodSec} sec` : 'N/A',
          swell_direction: swellDirection,
          wind_speed: windSpeedMph !== 'N/A' ? `${windSpeedMph} mph` : 'N/A',
          wind_direction: windDir,
          water_temp: waterTempF !== 'N/A' ? `${waterTempF}°F` : 'N/A',
          buoy_id: location.buoy_id,
          updated_at: new Date().toISOString(),
        };

        console.log(`Storing surf data for ${location.display_name}:`, surfData);

        const { error: surfError } = await supabase
          .from('surf_conditions')
          .upsert(surfData, { onConflict: 'date,location' });

        if (surfError) {
          console.error(`Error storing surf data for ${location.display_name}:`, surfError);
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: surfError.message,
          });
          continue;
        }

        console.log(`✅ Surf data stored successfully for ${location.display_name}`);
        
        results.push({
          success: true,
          location: location.display_name,
          locationId: location.id,
          message: 'Buoy data updated successfully',
          dataQuality: {
            hasWaveData,
            hasPeriodData,
            hasWindData,
            hasWaterTemp,
          },
        });

      } catch (error: any) {
        console.error(`❌ Error processing ${location.display_name}:`, error);
        
        // Retain previous valid data from today on error
        const previousValidData = await getMostRecentValidDataFromToday(supabase, location.id, today);
        
        if (previousValidData) {
          console.log(`✅ Retaining previous valid data from today for ${location.display_name} due to processing error`);
          results.push({
            success: true,
            location: location.display_name,
            locationId: location.id,
            message: 'Retained previous valid data from today - processing error',
            dataRetained: true,
            retainedFrom: previousValidData.updated_at,
          });
        } else {
          results.push({
            success: false,
            location: location.display_name,
            locationId: location.id,
            error: error.message,
          });
        }
      }
    }

    const allSucceeded = results.every(r => r.success);
    const someSucceeded = results.some(r => r.success);

    console.log('\n=== HOURLY BUOY DATA FETCH COMPLETED ===');
    console.log('EST Time:', currentTime);
    console.log(`Total locations: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    console.log(`Data retained from today: ${results.filter(r => r.dataRetained).length}`);
    console.log('=========================================');

    if (allSucceeded) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Hourly buoy data fetch completed successfully for all locations',
          estTime: currentTime,
          results: results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (someSucceeded) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Partial success - some locations failed or retained previous data from today',
          estTime: currentTime,
          results: results,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'All locations failed to fetch new data',
          estTime: currentTime,
          results: results,
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error: any) {
    console.error('💥 Fatal error in hourly buoy fetch:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
