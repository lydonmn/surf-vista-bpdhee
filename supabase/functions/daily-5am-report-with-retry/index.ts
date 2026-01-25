
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Daily 5AM Report] Starting report generation with retry logic...');

    // Get current EST date
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = estDate.toISOString().split('T')[0];
    
    console.log('[Daily 5AM Report] Target date:', dateStr);
    console.log('[Daily 5AM Report] Current EST time:', estDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));

    // Retry logic: Try up to 60 times (60 minutes) with 1 minute intervals
    const MAX_RETRIES = 60;
    const RETRY_DELAY_MS = 60000; // 1 minute
    
    let attempt = 0;
    let success = false;
    let lastError = null;

    while (attempt < MAX_RETRIES && !success) {
      attempt++;
      console.log(`[Daily 5AM Report] Attempt ${attempt}/${MAX_RETRIES}...`);

      try {
        // Step 1: Update buoy data
        console.log('[Daily 5AM Report] Updating buoy data...');
        const buoyResponse = await supabase.functions.invoke('update-buoy-data-only', {
          body: { date: dateStr },
        });

        if (buoyResponse.error) {
          throw new Error(`Buoy update failed: ${buoyResponse.error.message}`);
        }

        console.log('[Daily 5AM Report] Buoy data updated:', buoyResponse.data);

        // Step 2: Check if we have valid wave data
        const { data: surfConditions, error: surfError } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('date', dateStr)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (surfError) {
          throw new Error(`Failed to fetch surf conditions: ${surfError.message}`);
        }

        // Check if wave data is valid (not N/A)
        const hasValidWaveData = surfConditions && 
          surfConditions.wave_height && 
          surfConditions.wave_height !== 'N/A' &&
          surfConditions.wave_height !== '' &&
          !isNaN(parseFloat(surfConditions.wave_height));

        if (!hasValidWaveData) {
          console.log(`[Daily 5AM Report] No valid wave data yet on attempt ${attempt}. Wave height: ${surfConditions?.wave_height || 'null'}`);
          
          if (attempt < MAX_RETRIES) {
            console.log(`[Daily 5AM Report] Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          } else {
            throw new Error('Max retries reached without valid wave data');
          }
        }

        console.log('[Daily 5AM Report] Valid wave data found:', {
          wave_height: surfConditions.wave_height,
          surf_height: surfConditions.surf_height,
          wave_period: surfConditions.wave_period,
          updated_at: surfConditions.updated_at,
        });

        // Step 3: Update weather data
        console.log('[Daily 5AM Report] Updating weather data...');
        const weatherResponse = await supabase.functions.invoke('fetch-weather-data', {
          body: { date: dateStr },
        });

        if (weatherResponse.error) {
          console.warn('[Daily 5AM Report] Weather update failed:', weatherResponse.error);
        }

        // Step 4: Update tide data
        console.log('[Daily 5AM Report] Updating tide data...');
        const tideResponse = await supabase.functions.invoke('fetch-tide-data', {
          body: { date: dateStr },
        });

        if (tideResponse.error) {
          console.warn('[Daily 5AM Report] Tide update failed:', tideResponse.error);
        }

        // Step 5: Generate the daily report with improved narrative
        console.log('[Daily 5AM Report] Generating daily report...');
        
        // Get the capture time from surf_conditions
        const captureTime = surfConditions.updated_at 
          ? new Date(surfConditions.updated_at).toLocaleTimeString('en-US', { 
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true 
            })
          : '5:00 AM';

        // Generate witty and concise narrative
        const narrative = generateWittyNarrative(surfConditions, captureTime, dateStr);

        // Calculate surf rating (1-10)
        const rating = calculateSurfRating(surfConditions);

        // Insert or update the surf report
        const { data: existingReport } = await supabase
          .from('surf_reports')
          .select('id')
          .eq('date', dateStr)
          .maybeSingle();

        const reportData = {
          date: dateStr,
          wave_height: surfConditions.wave_height || 'N/A',
          surf_height: surfConditions.surf_height || surfConditions.wave_height || 'N/A',
          wave_period: surfConditions.wave_period || 'N/A',
          swell_direction: surfConditions.swell_direction || 'N/A',
          wind_speed: surfConditions.wind_speed || 'N/A',
          wind_direction: surfConditions.wind_direction || 'N/A',
          water_temp: surfConditions.water_temp || 'N/A',
          tide: 'See tide times',
          conditions: narrative,
          rating: rating,
          updated_at: new Date().toISOString(),
        };

        if (existingReport) {
          const { error: updateError } = await supabase
            .from('surf_reports')
            .update(reportData)
            .eq('id', existingReport.id);

          if (updateError) {
            throw new Error(`Failed to update report: ${updateError.message}`);
          }
          console.log('[Daily 5AM Report] Report updated successfully');
        } else {
          const { error: insertError } = await supabase
            .from('surf_reports')
            .insert([reportData]);

          if (insertError) {
            throw new Error(`Failed to insert report: ${insertError.message}`);
          }
          console.log('[Daily 5AM Report] Report created successfully');
        }

        success = true;
        console.log(`[Daily 5AM Report] SUCCESS on attempt ${attempt}!`);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Report generated successfully on attempt ${attempt}`,
            date: dateStr,
            captureTime: captureTime,
            attempts: attempt,
            rating: rating,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        lastError = error;
        console.error(`[Daily 5AM Report] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < MAX_RETRIES) {
          console.log(`[Daily 5AM Report] Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    // If we get here, all retries failed
    throw new Error(`Failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`);

  } catch (error) {
    console.error('[Daily 5AM Report] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Generate witty and concise narrative
function generateWittyNarrative(surfConditions: any, captureTime: string, date: string): string {
  const surfHeight = surfConditions.surf_height || surfConditions.wave_height || 'N/A';
  const period = surfConditions.wave_period || 'N/A';
  const direction = surfConditions.swell_direction || 'N/A';
  const windSpeed = surfConditions.wind_speed || 'N/A';
  const windDir = surfConditions.wind_direction || 'N/A';
  const waterTemp = surfConditions.water_temp || 'N/A';

  // Parse numeric values
  const surfHeightNum = parseFloat(surfHeight);
  const periodNum = parseFloat(period);
  const windSpeedNum = parseFloat(windSpeed);

  // Determine surf quality
  let quality = 'fair';
  let qualityEmoji = '🤙';
  
  if (surfHeightNum >= 4 && periodNum >= 10) {
    quality = 'epic';
    qualityEmoji = '🔥';
  } else if (surfHeightNum >= 3 && periodNum >= 8) {
    quality = 'solid';
    qualityEmoji = '💪';
  } else if (surfHeightNum >= 2 && periodNum >= 6) {
    quality = 'fun';
    qualityEmoji = '😎';
  } else if (surfHeightNum < 2) {
    quality = 'mellow';
    qualityEmoji = '🧘';
  }

  // Wind assessment
  let windEffect = '';
  if (windSpeedNum < 5) {
    windEffect = 'glassy conditions';
  } else if (windSpeedNum < 10) {
    windEffect = 'light winds keeping it clean';
  } else if (windSpeedNum < 15) {
    windEffect = 'moderate winds adding some texture';
  } else {
    windEffect = 'breezy conditions creating some chop';
  }

  // Build the narrative
  const intro = `${qualityEmoji} Buoy check at ${captureTime}: `;
  
  const surfDescription = surfHeightNum >= 3 
    ? `${surfHeight} rideable faces with ${period} second intervals - that's what we're talking about!`
    : surfHeightNum >= 2
    ? `${surfHeight} waves rolling through at ${period} seconds - plenty to work with.`
    : `${surfHeight} ankle-slappers at ${period} seconds - better than a desk job.`;

  const swellInfo = direction !== 'N/A' 
    ? ` Swell from ${direction}.`
    : '';

  const windInfo = ` Wind: ${windSpeed} mph ${windDir} - ${windEffect}.`;

  const waterInfo = waterTemp !== 'N/A' 
    ? ` Water's sitting at ${waterTemp}.`
    : '';

  // Forecast for the day
  let forecast = '';
  if (surfHeightNum >= 3) {
    forecast = ' Get out there before the crowds show up. Conditions should hold through mid-morning, then expect the usual afternoon sea breeze to kick in.';
  } else if (surfHeightNum >= 2) {
    forecast = ' Morning session recommended - winds typically pick up after lunch. Perfect for longboarders and beginners.';
  } else {
    forecast = ' Might be worth checking back later - sometimes the afternoon brings a surprise. Otherwise, good day for a beach walk.';
  }

  return intro + surfDescription + swellInfo + windInfo + waterInfo + forecast;
}

// Calculate surf rating (1-10)
function calculateSurfRating(surfConditions: any): number {
  const surfHeight = parseFloat(surfConditions.surf_height || surfConditions.wave_height || '0');
  const period = parseFloat(surfConditions.wave_period || '0');
  const windSpeed = parseFloat(surfConditions.wind_speed || '0');

  let rating = 5; // Base rating

  // Height contribution (0-4 points)
  if (surfHeight >= 6) rating += 4;
  else if (surfHeight >= 4) rating += 3;
  else if (surfHeight >= 3) rating += 2;
  else if (surfHeight >= 2) rating += 1;
  else if (surfHeight < 1) rating -= 2;

  // Period contribution (0-3 points)
  if (period >= 12) rating += 3;
  else if (period >= 10) rating += 2;
  else if (period >= 8) rating += 1;
  else if (period < 6) rating -= 1;

  // Wind contribution (-2 to +1 points)
  if (windSpeed < 5) rating += 1; // Glassy
  else if (windSpeed > 15) rating -= 2; // Too windy

  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, Math.round(rating)));
}
