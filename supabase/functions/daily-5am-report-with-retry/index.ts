
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

    // Parse request body to check for specific location
    let targetLocationId: string | null = null;
    try {
      const body = await req.json();
      if (body.location) {
        targetLocationId = body.location;
        console.log('[Daily 5AM Report] Single location mode - target:', targetLocationId);
      }
    } catch (e) {
      console.log('[Daily 5AM Report] No location parameter - processing all locations');
    }

    console.log('[Daily 5AM Report] ═══════════════════════════════════════');
    console.log('[Daily 5AM Report] 🌅 REPORT GENERATION STARTED');
    console.log('[Daily 5AM Report] ═══════════════════════════════════════');
    console.log('[Daily 5AM Report] 🔧 Features:');
    console.log('[Daily 5AM Report]   • Up to 5 retry attempts per location');
    console.log('[Daily 5AM Report]   • Progressive delays: 5s, 10s, 20s, 30s, 60s');
    console.log('[Daily 5AM Report]   • Dynamic location support');
    console.log('[Daily 5AM Report]   • Push notifications for opted-in users');
    console.log('[Daily 5AM Report]   • Single location or bulk processing');
    console.log('[Daily 5AM Report]   • Handles buoy sensor failures gracefully');
    console.log('[Daily 5AM Report] ═══════════════════════════════════════');

    // Fetch locations - either specific one or all active
    let locationsQuery = supabase
      .from('locations')
      .select('id, name, display_name')
      .eq('is_active', true);
    
    if (targetLocationId) {
      locationsQuery = locationsQuery.eq('id', targetLocationId);
    }
    
    const { data: locationsData, error: locationsError } = await locationsQuery.order('name');

    if (locationsError) {
      console.error('[Daily 5AM Report] Error fetching locations:', locationsError);
      throw new Error(`Failed to fetch locations: ${locationsError.message}`);
    }

    if (!locationsData || locationsData.length === 0) {
      const errorMsg = targetLocationId 
        ? `Location '${targetLocationId}' not found or inactive`
        : 'No active locations found in database';
      console.warn('[Daily 5AM Report]', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const modeText = targetLocationId ? 'single location' : `${locationsData.length} location(s)`;
    console.log(`[Daily 5AM Report] Processing ${modeText}:`, locationsData.map(l => l.display_name).join(', '));

    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = estDate.toISOString().split('T')[0];
    
    console.log('[Daily 5AM Report] 📅 Target date:', dateStr);
    console.log('[Daily 5AM Report] ⏰ Current EST time:', estDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));

    const results = [];
    
    for (const location of locationsData) {
      console.log(`\n[Daily 5AM Report] ═══════════════════════════════════════`);
      console.log(`[Daily 5AM Report] 📍 Processing ${location.display_name}...`);
      console.log(`[Daily 5AM Report] ═══════════════════════════════════════`);
      
      const result = await processLocation(supabase, location.id, location.display_name, dateStr);
      results.push(result);
      
      if (result.success) {
        console.log(`[Daily 5AM Report] ✅ ${location.display_name}: SUCCESS`);
        
        // Only send notifications if processing all locations (automated run)
        // Don't send notifications for single location admin updates
        if (!result.skipped && !targetLocationId) {
          console.log(`[Daily 5AM Report] 📲 Sending push notifications for ${location.display_name}...`);
          try {
            const notificationResult = await supabase.functions.invoke('send-daily-report-notifications', {
              body: { 
                location: location.id,
                date: dateStr,
              },
            });

            if (notificationResult.data?.success) {
              console.log(`[Daily 5AM Report] ✅ Notifications sent: ${notificationResult.data.notificationsSent} users`);
            } else {
              console.warn(`[Daily 5AM Report] ⚠️ Notification send failed:`, notificationResult.error);
            }
          } catch (notifError) {
            console.error(`[Daily 5AM Report] ❌ Notification error:`, notifError);
          }
        } else if (targetLocationId) {
          console.log(`[Daily 5AM Report] ℹ️ Skipping notifications (single location admin update)`);
        }
      } else {
        console.log(`[Daily 5AM Report] ❌ ${location.display_name}: FAILED - ${result.error}`);
      }
    }

    const allSucceeded = results.every(r => r.success);
    const someSucceeded = results.some(r => r.success);

    console.log('\n[Daily 5AM Report] ═══════════════════════════════════════');
    console.log('[Daily 5AM Report] 📊 FINAL RESULTS:');
    console.log(`[Daily 5AM Report] Total locations: ${results.length}`);
    console.log(`[Daily 5AM Report] Successful: ${results.filter(r => r.success).length}`);
    console.log(`[Daily 5AM Report] Failed: ${results.filter(r => !r.success).length}`);
    console.log('[Daily 5AM Report] ═══════════════════════════════════════');

    if (allSucceeded) {
      console.log('[Daily 5AM Report] ✅ All locations processed successfully!');
      const message = targetLocationId 
        ? `Report generated successfully for ${locationsData[0].display_name}`
        : 'Daily reports generated and notifications sent successfully for all locations';
      return new Response(
        JSON.stringify({
          success: true,
          message: message,
          date: dateStr,
          results: results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (someSucceeded) {
      console.log('[Daily 5AM Report] ⚠️ Some locations succeeded, some failed');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Partial success - some locations failed',
          date: dateStr,
          results: results,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.log('[Daily 5AM Report] ❌ All locations failed');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'All locations failed to generate reports',
          date: dateStr,
          results: results,
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('[Daily 5AM Report] 💥 Fatal error:', error);
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

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processLocation(supabase: any, locationId: string, locationName: string, dateStr: string) {
  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [5000, 10000, 20000, 30000, 60000];
  
  try {
    console.log(`[${locationName}] Checking if report already exists for today...`);
    
    const { data: existingReport } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();

    if (existingReport && existingReport.conditions && existingReport.conditions.length > 100) {
      console.log(`[${locationName}] ✅ Valid report already exists for today - skipping`);
      console.log(`[${locationName}] Report has ${existingReport.conditions.length} character narrative`);
      return {
        success: true,
        location: locationName,
        locationId: locationId,
        message: 'Report already exists',
        skipped: true,
      };
    }

    console.log(`[${locationName}] No existing report found or report is incomplete - generating new report`);

    console.log(`[${locationName}] Step 1: Fetching weather data...`);
    let weatherData = null;
    try {
      const { data: weatherResult, error: weatherError } = await supabase.functions.invoke('fetch-weather-data', {
        body: { location: locationId },
      });

      if (weatherError) {
        console.warn(`[${locationName}] Weather fetch warning:`, weatherError);
      } else if (weatherResult?.success) {
        console.log(`[${locationName}] ✅ Weather data fetched successfully`);
        
        const { data: weatherDbData } = await supabase
          .from('weather_data')
          .select('*')
          .eq('date', dateStr)
          .eq('location', locationId)
          .maybeSingle();
        
        weatherData = weatherDbData;
      }
    } catch (weatherError) {
      console.warn(`[${locationName}] Weather fetch failed (non-critical):`, weatherError);
    }

    console.log(`[${locationName}] Step 2: Fetching tide data...`);
    let tideDataArray = [];
    try {
      const { data: tideResult, error: tideError } = await supabase.functions.invoke('fetch-tide-data', {
        body: { location: locationId },
      });

      if (tideError) {
        console.warn(`[${locationName}] Tide fetch warning:`, tideError);
      } else if (tideResult?.success) {
        console.log(`[${locationName}] ✅ Tide data fetched successfully`);
        
        const { data: tideDbData } = await supabase
          .from('tide_data')
          .select('*')
          .eq('date', dateStr)
          .eq('location', locationId)
          .order('time');
        
        tideDataArray = tideDbData || [];
      }
    } catch (tideError) {
      console.warn(`[${locationName}] Tide fetch failed (non-critical):`, tideError);
    }

    console.log(`[${locationName}] Weather data:`, weatherData ? 'Found' : 'Not found');
    console.log(`[${locationName}] Tide data: ${tideDataArray.length} records`);

    let lastError = null;
    let surfConditions = null;
    
    console.log(`[${locationName}] Step 3: Fetching surf/buoy data with retry logic...`);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[${locationName}] Attempt ${attempt}/${MAX_RETRIES}: Fetching fresh buoy data...`);
        
        const { data: buoyData, error: buoyError } = await supabase.functions.invoke('fetch-surf-reports', {
          body: { location: locationId },
        });

        if (buoyError) {
          console.warn(`[${locationName}] Attempt ${attempt}: Buoy fetch warning:`, buoyError);
        }

        console.log(`[${locationName}] Attempt ${attempt}: Buoy data response:`, buoyData);

        console.log(`[${locationName}] Waiting for database to update...`);
        await delay(1000);

        const { data: fetchedConditions, error: surfError } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('date', dateStr)
          .eq('location', locationId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (surfError) {
          throw new Error(`Failed to fetch surf conditions: ${surfError.message}`);
        }

        console.log(`[${locationName}] Attempt ${attempt}: Fetched conditions:`, fetchedConditions);

        const hasWaveData = fetchedConditions && (
          (fetchedConditions.wave_height && fetchedConditions.wave_height !== 'N/A' && fetchedConditions.wave_height !== '') ||
          (fetchedConditions.surf_height && fetchedConditions.surf_height !== 'N/A' && fetchedConditions.surf_height !== '')
        );

        const hasBuoyData = fetchedConditions && (
          (fetchedConditions.wind_speed && fetchedConditions.wind_speed !== 'N/A') ||
          (fetchedConditions.water_temp && fetchedConditions.water_temp !== 'N/A')
        );

        if (hasWaveData) {
          console.log(`[${locationName}] ✅ Attempt ${attempt}: Valid wave data found!`, {
            wave_height: fetchedConditions.wave_height,
            surf_height: fetchedConditions.surf_height,
            wave_period: fetchedConditions.wave_period,
            updated_at: fetchedConditions.updated_at,
          });
          surfConditions = fetchedConditions;
          break;
        } else if (hasBuoyData) {
          console.log(`[${locationName}] ⚠️ Attempt ${attempt}: No wave data, but buoy is online with wind/temp data`);
          console.log(`[${locationName}] Wind: ${fetchedConditions.wind_speed}, Water Temp: ${fetchedConditions.water_temp}`);
          
          if (attempt === MAX_RETRIES || (fetchedConditions.wind_speed !== 'N/A' && fetchedConditions.water_temp !== 'N/A')) {
            console.log(`[${locationName}] ✅ Proceeding with available data (wave sensors offline)`);
            surfConditions = fetchedConditions;
            break;
          }
          
          lastError = `Wave sensors offline, retrying... (${attempt}/${MAX_RETRIES})`;
        } else {
          const errorMsg = `No valid buoy data available. Wave height: ${fetchedConditions?.wave_height || 'null'}, Wind: ${fetchedConditions?.wind_speed || 'null'}`;
          console.log(`[${locationName}] ⚠️ Attempt ${attempt}/${MAX_RETRIES}: ${errorMsg}`);
          lastError = errorMsg;
        }
        
        if (attempt < MAX_RETRIES) {
          const delayMs = RETRY_DELAYS[attempt - 1];
          console.log(`[${locationName}] Waiting ${delayMs/1000} seconds before retry ${attempt + 1}...`);
          await delay(delayMs);
        }
      } catch (attemptError) {
        console.error(`[${locationName}] Attempt ${attempt} error:`, attemptError);
        lastError = attemptError.message;
        
        if (attempt < MAX_RETRIES) {
          const delayMs = RETRY_DELAYS[attempt - 1];
          console.log(`[${locationName}] Waiting ${delayMs/1000} seconds before retry ${attempt + 1}...`);
          await delay(delayMs);
        }
      }
    }

    if (!surfConditions) {
      console.error(`[${locationName}] ❌ All ${MAX_RETRIES} attempts failed. Last error: ${lastError}`);
      throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError}`);
    }

    console.log(`[${locationName}] Step 4: Generating daily report...`);
    
    const captureTime = surfConditions.updated_at 
      ? new Date(surfConditions.updated_at).toLocaleTimeString('en-US', { 
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true 
        })
      : '5:00 AM';

    const narrative = generateWittyNarrative(
      surfConditions, 
      captureTime, 
      dateStr,
      weatherData,
      tideDataArray
    );

    console.log(`[${locationName}] Generated narrative (${narrative.length} characters)`);

    const rating = calculateSurfRating(surfConditions);
    console.log(`[${locationName}] Calculated rating: ${rating}/10`);

    const reportData = {
      date: dateStr,
      location: locationId,
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

    console.log(`[${locationName}] Upserting report to database...`);

    const { error: upsertError } = await supabase
      .from('surf_reports')
      .upsert(reportData, { onConflict: 'date,location' });

    if (upsertError) {
      throw new Error(`Failed to save report: ${upsertError.message}`);
    }

    console.log(`[${locationName}] ✅ Report created successfully`);

    return {
      success: true,
      location: locationName,
      locationId: locationId,
      date: dateStr,
      captureTime: captureTime,
      rating: rating,
      hasWaveData: surfConditions.wave_height !== 'N/A',
    };

  } catch (error) {
    console.error(`[${locationName}] ❌ Failed:`, error.message);
    return {
      success: false,
      location: locationName,
      locationId: locationId,
      error: error.message,
    };
  }
}

function parseNumericValue(value: string | null | undefined, defaultValue: number = 0): number {
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  const match = value.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

function selectRandom<T>(array: T[]): T {
  const index = Math.floor((Date.now() + Math.random() * 1000) / 100) % array.length;
  return array[index];
}

function generateTideSummary(tideData: any[]): string {
  if (tideData.length === 0) {
    return 'Tide data unavailable';
  }

  const tides = tideData.map(t => `${t.type} at ${t.time} (${t.height}${t.height_unit})`);
  return tides.join(', ');
}

function generateWittyNarrative(
  surfConditions: any, 
  captureTime: string, 
  date: string,
  weatherData: any = null,
  tideData: any[] = []
): string {
  try {
    const rideableFaceStr = surfConditions.surf_height || surfConditions.wave_height;
    
    const waveSensorsOffline = !rideableFaceStr || rideableFaceStr === 'N/A';
    
    if (waveSensorsOffline) {
      console.log('Wave sensors offline - generating fallback narrative');
      
      const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'conditions unavailable';
      const windSpeed = surfConditions.wind_speed || 'N/A';
      const windDir = surfConditions.wind_direction || 'Variable';
      const waterTemp = surfConditions.water_temp || 'N/A';
      const buoyId = surfConditions.buoy_id || 'unknown';
      
      const locationSeed = date.split('-').reduce((acc, val) => acc + parseInt(val), 0);
      const messages = [
        `The wave sensors on buoy ${buoyId} aren't reporting right now, so we can't give you rideable face heights or periods. The buoy is online though - winds are ${windSpeed} from the ${windDir}, water temp is ${waterTemp}, and weather is ${weatherConditions.toLowerCase()}. Check local surf cams or head to the beach to see what's actually happening out there!`,
        `Wave sensors are offline on buoy ${buoyId} today, so no wave data available. Wind is ${windSpeed} from the ${windDir}, water's at ${waterTemp}, and it's ${weatherConditions.toLowerCase()}. Your best bet is to check the beach in person or look at surf cams for current conditions.`,
        `Buoy ${buoyId} wave sensors are down at the moment - can't pull rideable face data. However, wind conditions show ${windSpeed} from the ${windDir}, water temperature is ${waterTemp}, and the weather is ${weatherConditions.toLowerCase()}. Recommend checking visual reports or heading down to scout it yourself.`,
      ];
      
      const index = locationSeed % messages.length;
      return messages[index];
    }
    
    // ✅ CRITICAL FIX: Parse numeric value and ALWAYS include units
    const rideableFaceNum = parseNumericValue(rideableFaceStr, 0);
    const rideableFace = `${rideableFaceNum.toFixed(1)} feet`; // ALWAYS include "feet"
    
    const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
    const windSpeedText = `${windSpeed.toFixed(0)} mph`; // ALWAYS include "mph"
    
    const windDir = surfConditions.wind_direction || 'Variable';
    const swellDir = surfConditions.swell_direction || 'Variable';
    const period = surfConditions.wave_period || 'N/A';
    const periodNum = parseNumericValue(period, 0);
    const periodText = periodNum > 0 ? `${periodNum.toFixed(0)} seconds` : 'N/A'; // ALWAYS include "seconds"
    
    const waterTemp = surfConditions.water_temp || 'N/A';

    const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
    const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

    const rating = calculateSurfRating(surfConditions);
    const locationSeed = date.split('-').reduce((acc, val) => acc + parseInt(val), 0) + (surfConditions.location === 'pawleys-island' ? 100 : 0);

    let report = '';

    if (rating >= 8) {
      const openings = [
        'It\'s absolutely firing out there!',
        'Epic conditions today!',
        'You gotta see this - it\'s going off!',
        'Premium surf conditions right now!',
        'Stellar session potential today!',
        'The ocean is delivering today!',
      ];
      report += openings[locationSeed % openings.length];
    } else if (rating >= 6) {
      const openings = [
        'Looking pretty fun out there today.',
        'Decent waves rolling through.',
        'Not bad at all - worth checking out.',
        'Solid conditions for a session.',
        'Good vibes in the water today.',
        'Respectable surf on tap.',
      ];
      report += openings[locationSeed % openings.length];
    } else if (rating >= 4) {
      const openings = [
        'Small but rideable conditions.',
        'Pretty mellow out there.',
        'Not much size but it\'s clean.',
        'Manageable conditions for all levels.',
        'Gentle waves for a cruisy session.',
        'Modest swell but still surfable.',
      ];
      report += openings[locationSeed % openings.length];
    } else {
      const openings = [
        'Pretty flat today.',
        'Not much happening.',
        'Minimal surf conditions.',
        'Small day at the beach.',
        'Quiet conditions out there.',
        'Low energy swell today.',
      ];
      report += openings[locationSeed % openings.length];
    }

    report += ` (Buoy check at ${captureTime}) `;

    report += '\n\n🌊 SURF CONDITIONS: ';
    
    if (rideableFaceNum >= 7) {
      const descriptions = [
        `We're seeing a massive ${swellDir} swell with rideable faces stacking up overhead at ${rideableFace}. `,
        `A powerful ${swellDir} swell is producing overhead rideable faces measuring ${rideableFace}. `,
        `Significant ${swellDir} energy with rideable wave faces reaching ${rideableFace} overhead. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        report += `The faces are clean and well-formed, offering powerful rides with plenty of push. `;
      } else {
        report += `However, the wind is creating some texture on the faces, making it challenging but still rideable for experienced surfers. `;
      }
    } else if (rideableFaceNum >= 4.5) {
      const descriptions = [
        `A solid ${swellDir} swell is delivering chest to head high rideable faces at ${rideableFace}. `,
        `Quality ${swellDir} swell producing rideable wave faces in the ${rideableFace} range, chest to head high. `,
        `${swellDir} swell energy creating rideable faces measuring ${rideableFace} from chest to overhead. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        report += `The wave faces are glassy and well-shaped, perfect for carving and generating speed. `;
      } else {
        report += `There's some wind chop on the faces, but the size makes up for it with plenty of power. `;
      }
    } else if (rideableFaceNum >= 2) {
      const descriptions = [
        `A small ${swellDir} swell is producing waist to chest high rideable faces at ${rideableFace}. `,
        `Modest ${swellDir} swell with rideable wave faces in the ${rideableFace} range, waist to chest high. `,
        `${swellDir} swell creating rideable faces measuring ${rideableFace}, waist to chest level. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        report += `The conditions are clean and organized, ideal for practicing maneuvers and longboarding. `;
      } else {
        report += `The wind is adding some bump to the faces, making it a bit choppy but still fun. `;
      }
    } else if (rideableFaceNum >= 1) {
      report += `Minimal swell with ankle to knee high rideable faces at ${rideableFace}. `;
      if (isClean) {
        report += `Despite the small size, the faces are smooth - perfect for beginners or longboard cruising. `;
      } else {
        report += `The small size combined with wind chop makes it challenging, best for practicing pop-ups. `;
      }
    } else {
      report += `Very minimal swell with rideable faces barely reaching ankle high at ${rideableFace}. Better suited for swimming or stand-up paddleboarding than surfing today. `;
    }

    if (periodNum >= 12) {
      report += `The wave period is ${periodText}, which is excellent - these are long-period groundswells that pack serious punch and create well-defined sets. `;
    } else if (periodNum >= 10) {
      report += `Wave period is ${periodText}, indicating a good quality swell with decent power and organized sets. `;
    } else if (periodNum >= 8) {
      report += `Wave period is ${periodText}, providing moderate energy with reasonably spaced sets. `;
    } else if (periodNum >= 6) {
      report += `Wave period is ${periodText}, which is on the shorter side - expect more frequent but less powerful waves. `;
    } else if (periodNum > 0) {
      report += `Short wave period at ${periodText} means choppy, wind-driven waves with limited power. `;
    }

    report += '\n\n💨 WIND CONDITIONS: ';
    
    if (isOffshore) {
      if (windSpeed < 5) {
        report += `Nearly calm offshore winds at ${windSpeedText} from the ${windDir} are creating pristine, glassy conditions. `;
      } else if (windSpeed < 10) {
        report += `Light offshore winds at ${windSpeedText} from the ${windDir} are grooming the wave faces beautifully. `;
      } else if (windSpeed < 15) {
        report += `Moderate offshore winds at ${windSpeedText} from the ${windDir} are holding up the wave faces nicely. `;
      } else {
        report += `Strong offshore winds at ${windSpeedText} from the ${windDir} are blowing hard - making paddling challenging. `;
      }
    } else {
      if (windSpeed < 5) {
        report += `Nearly calm onshore winds at ${windSpeedText} from the ${windDir} aren't causing much texture. `;
      } else if (windSpeed < 8) {
        report += `Light onshore winds at ${windSpeedText} from the ${windDir} are adding slight texture but still surfable. `;
      } else if (windSpeed < 12) {
        report += `Moderate onshore winds at ${windSpeedText} from the ${windDir} are creating noticeable chop. `;
      } else {
        report += `Strong onshore winds at ${windSpeedText} from the ${windDir} are making conditions quite choppy. `;
      }
    }

    if (weatherData) {
      report += '\n\n☀️ WEATHER: ';
      const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
      const temp = weatherData.temperature ? `${weatherData.temperature}°F` : 'temperature unavailable';
      
      report += `Current conditions are ${weatherConditions.toLowerCase()}`;
      if (weatherData.temperature) {
        report += ` with air temperature at ${temp}`;
      }
      report += `. Water temperature is ${waterTemp}. `;
    }

    report += '\n\n📋 RECOMMENDATION: ';
    
    if (rating >= 8) {
      const closings = [
        'Drop everything and get out here! These are the conditions you dream about.',
        'This is the one you don\'t want to miss! Everything is lining up perfectly.',
        'Absolutely worth the session! Premium conditions like this don\'t come around often.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 6) {
      const closings = [
        'Definitely worth checking out if you\'ve got time. The conditions are solid.',
        'Should be a fun session. Nothing epic, but definitely good enough to make it worth your while.',
        'Worth the paddle out. You\'ll get plenty of waves and have a good time.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 4) {
      const closings = [
        'Could be fun for beginners or longboarders. Perfect for learning or cruising.',
        'Decent for a mellow session. Great for working on technique.',
        'Not epic but rideable. Perfect for a casual session.',
      ];
      report += selectRandom(closings);
    } else {
      const closings = [
        'Maybe wait for the next swell. Check back tomorrow.',
        'Not really worth it today. Better to wait for when conditions improve.',
        'Pretty minimal today. Save your energy for a better swell.',
      ];
      report += selectRandom(closings);
    }

    return report;
  } catch (error) {
    console.error('Error generating narrative:', error);
    return 'Unable to generate surf report at this time. Please check back later.';
  }
}

function calculateSurfRating(surfConditions: any): number {
  const surfHeightStr = surfConditions.surf_height || surfConditions.wave_height || '0';
  const periodStr = surfConditions.wave_period || '0';
  const windSpeedStr = surfConditions.wind_speed || '0';
  
  if (surfHeightStr === 'N/A' || surfHeightStr === '') {
    console.log('Wave sensors offline - returning neutral rating of 5');
    return 5;
  }
  
  const surfHeight = parseFloat(surfHeightStr);
  const period = parseFloat(periodStr);
  const windSpeed = parseFloat(windSpeedStr);

  let rating = 5;

  if (surfHeight >= 6) rating += 4;
  else if (surfHeight >= 4) rating += 3;
  else if (surfHeight >= 3) rating += 2;
  else if (surfHeight >= 2) rating += 1;
  else if (surfHeight < 1) rating -= 2;

  if (period >= 12) rating += 3;
  else if (period >= 10) rating += 2;
  else if (period >= 8) rating += 1;
  else if (period < 6 && period > 0) rating -= 1;

  if (windSpeed < 5) rating += 1;
  else if (windSpeed > 15) rating -= 2;

  const finalRating = Math.max(1, Math.min(10, Math.round(rating)));
  console.log(`Rating calculation: height=${surfHeight}, period=${period}, wind=${windSpeed} -> rating=${finalRating}`);
  
  return finalRating;
}
