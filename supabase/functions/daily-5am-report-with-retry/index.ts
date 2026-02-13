
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Location-specific personality traits
const LOCATION_PERSONALITIES: Record<string, {
  casual: string[];
  excited: string[];
  disappointed: string[];
  nickname: string;
}> = {
  'folly-beach': {
    casual: ['Folly', 'the Edge of America', 'Folly Beach'],
    excited: ['Folly is firing', 'Folly is going off', 'Folly is pumping'],
    disappointed: ['not much happening at Folly', 'Folly is pretty flat', 'Folly is taking a rest'],
    nickname: 'Folly'
  },
  'pawleys-island': {
    casual: ['Pawleys', 'the island', 'Pawleys Island'],
    excited: ['Pawleys has swell', 'Pawleys is working', 'Pawleys is delivering'],
    disappointed: ['not a wave on Pawleys', 'Pawleys is dead flat', 'Pawleys is sleeping'],
    nickname: 'Pawleys'
  },
  'holden-beach-nc': {
    casual: ['Holden', 'Holden Beach', 'the beach'],
    excited: ['Holden is cranking', 'Holden has waves', 'Holden is alive'],
    disappointed: ['Holden is flat', 'nothing at Holden', 'Holden is quiet'],
    nickname: 'Holden'
  }
};

function getLocationPersonality(locationId: string) {
  return LOCATION_PERSONALITIES[locationId] || LOCATION_PERSONALITIES['folly-beach'];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const results = [];
    
    for (const location of locationsData) {
      console.log(`\n[Daily 5AM Report] ═══════════════════════════════════════`);
      console.log(`[Daily 5AM Report] 📍 Processing ${location.display_name}...`);
      console.log(`[Daily 5AM Report] ═══════════════════════════════════════`);
      
      const result = await processLocation(supabase, location.id, location.display_name, dateStr);
      results.push(result);
      
      if (result.success) {
        console.log(`[Daily 5AM Report] ✅ ${location.display_name}: SUCCESS`);
        
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
      return {
        success: true,
        location: locationName,
        locationId: locationId,
        message: 'Report already exists',
        skipped: true,
      };
    }

    console.log(`[${locationName}] Generating new report...`);

    console.log(`[${locationName}] Step 1: Fetching weather data...`);
    let weatherData = null;
    try {
      const { data: weatherResult, error: weatherError } = await supabase.functions.invoke('fetch-weather-data', {
        body: { location: locationId },
      });

      if (weatherError) {
        console.warn(`[${locationName}] Weather fetch warning:`, weatherError);
      } else if (weatherResult?.success) {
        console.log(`[${locationName}] ✅ Weather data fetched`);
        
        const { data: weatherDbData } = await supabase
          .from('weather_data')
          .select('*')
          .eq('date', dateStr)
          .eq('location', locationId)
          .maybeSingle();
        
        weatherData = weatherDbData;
      }
    } catch (weatherError) {
      console.warn(`[${locationName}] Weather fetch failed:`, weatherError);
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
        console.log(`[${locationName}] ✅ Tide data fetched`);
        
        const { data: tideDbData } = await supabase
          .from('tide_data')
          .select('*')
          .eq('date', dateStr)
          .eq('location', locationId)
          .order('time');
        
        tideDataArray = tideDbData || [];
      }
    } catch (tideError) {
      console.warn(`[${locationName}] Tide fetch failed:`, tideError);
    }

    let lastError = null;
    let surfConditions = null;
    
    console.log(`[${locationName}] Step 3: Fetching surf/buoy data with retry logic...`);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[${locationName}] Attempt ${attempt}/${MAX_RETRIES}: Fetching buoy data...`);
        
        const { data: buoyData, error: buoyError } = await supabase.functions.invoke('fetch-surf-reports', {
          body: { location: locationId },
        });

        if (buoyError) {
          console.warn(`[${locationName}] Attempt ${attempt}: Buoy fetch warning:`, buoyError);
        }

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

        const hasWaveData = fetchedConditions && (
          (fetchedConditions.wave_height && fetchedConditions.wave_height !== 'N/A' && fetchedConditions.wave_height !== '') ||
          (fetchedConditions.surf_height && fetchedConditions.surf_height !== 'N/A' && fetchedConditions.surf_height !== '')
        );

        const hasBuoyData = fetchedConditions && (
          (fetchedConditions.wind_speed && fetchedConditions.wind_speed !== 'N/A') ||
          (fetchedConditions.water_temp && fetchedConditions.water_temp !== 'N/A')
        );

        if (hasWaveData) {
          console.log(`[${locationName}] ✅ Attempt ${attempt}: Valid wave data found!`);
          surfConditions = fetchedConditions;
          break;
        } else if (hasBuoyData) {
          console.log(`[${locationName}] ⚠️ Attempt ${attempt}: No wave data, but buoy is online`);
          
          if (attempt === MAX_RETRIES || (fetchedConditions.wind_speed !== 'N/A' && fetchedConditions.water_temp !== 'N/A')) {
            console.log(`[${locationName}] ✅ Proceeding with available data (wave sensors offline)`);
            surfConditions = fetchedConditions;
            break;
          }
          
          lastError = `Wave sensors offline, retrying... (${attempt}/${MAX_RETRIES})`;
        } else {
          const errorMsg = `No valid buoy data available`;
          console.log(`[${locationName}] ⚠️ Attempt ${attempt}/${MAX_RETRIES}: ${errorMsg}`);
          lastError = errorMsg;
        }
        
        if (attempt < MAX_RETRIES) {
          const delayMs = RETRY_DELAYS[attempt - 1];
          console.log(`[${locationName}] Waiting ${delayMs/1000} seconds before retry...`);
          await delay(delayMs);
        }
      } catch (attemptError) {
        console.error(`[${locationName}] Attempt ${attempt} error:`, attemptError);
        lastError = attemptError.message;
        
        if (attempt < MAX_RETRIES) {
          const delayMs = RETRY_DELAYS[attempt - 1];
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
    const locationId = surfConditions.location || 'folly-beach';
    const personality = getLocationPersonality(locationId);
    
    const rideableFaceStr = surfConditions.surf_height || surfConditions.wave_height;
    
    const waveSensorsOffline = !rideableFaceStr || rideableFaceStr === 'N/A';
    
    if (waveSensorsOffline) {
      console.log('Wave sensors offline - generating fallback narrative');
      
      const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'conditions unavailable';
      const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
      const windDir = surfConditions.wind_direction || 'variable';
      const waterTemp = parseNumericValue(surfConditions.water_temp, 0);
      const buoyId = surfConditions.buoy_id || 'unknown';
      
      const windText = windSpeed > 0 ? `${windSpeed.toFixed(0)} mph ${windDir}` : 'calm';
      const waterText = waterTemp > 0 ? `${waterTemp.toFixed(0)}°F` : 'unknown temp';
      
      const seed = locationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Date.now() / 86400000);
      
      const messages = [
        `Wave sensors are offline at ${personality.nickname} today, so we can't give you exact wave heights. The buoy is still reporting though - wind is ${windText}, water is ${waterText}, and it's ${weatherConditions.toLowerCase()}. Best bet is to check the beach cam or drive down to see what's actually out there.`,
        
        `No wave data from ${personality.nickname} right now - sensors are down. We've got wind at ${windText}, water temp at ${waterText}, and ${weatherConditions.toLowerCase()} skies. Check the local surf cam or head down to scout it yourself.`,
        
        `Buoy sensors are down at ${personality.nickname} - no wave readings available. Wind is ${windText}, water's ${waterText}, weather is ${weatherConditions.toLowerCase()}. You'll need to eyeball it from the beach or check a surf cam.`
      ];
      
      return messages[seed % messages.length];
    }
    
    const waveHeight = parseNumericValue(rideableFaceStr, 0);
    const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
    const windDir = surfConditions.wind_direction || 'variable';
    const swellDir = surfConditions.swell_direction || 'mixed';
    const period = parseNumericValue(surfConditions.wave_period, 0);
    const waterTemp = parseNumericValue(surfConditions.water_temp, 0);
    const airTemp = parseNumericValue(weatherData?.temperature, 0);
    const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'partly cloudy';

    const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
    
    const rating = calculateSurfRating(surfConditions);
    const seed = locationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Date.now() / 86400000);

    let report = '';

    // OPENING - Location-specific personality
    if (rating >= 8) {
      const openings = [
        `${personality.excited[seed % personality.excited.length]} today!`,
        `Epic session at ${personality.nickname} right now.`,
        `You need to see ${personality.nickname} today - it's incredible.`,
      ];
      report += openings[seed % openings.length];
    } else if (rating >= 6) {
      const openings = [
        `${personality.casual[seed % personality.casual.length]} is looking fun today.`,
        `Solid conditions at ${personality.nickname}.`,
        `Worth checking out ${personality.nickname} today.`,
      ];
      report += openings[seed % openings.length];
    } else if (rating >= 4) {
      const openings = [
        `Small but rideable at ${personality.nickname}.`,
        `Mellow day at ${personality.nickname}.`,
        `${personality.nickname} has some small waves.`,
      ];
      report += openings[seed % openings.length];
    } else {
      const openings = [
        `${personality.disappointed[seed % personality.disappointed.length]} today.`,
        `Pretty quiet at ${personality.nickname}.`,
        `Minimal surf at ${personality.nickname} right now.`,
      ];
      report += openings[seed % openings.length];
    }

    report += '\n\n';

    // WAVE CONDITIONS - Natural, conversational language (NO REDUNDANT UNITS)
    if (waveHeight >= 7) {
      report += `Overhead sets rolling in from the ${swellDir}`;
      if (waveHeight >= 10) {
        report += ` - we're talking ${waveHeight.toFixed(1)} feet, well overhead`;
      } else {
        report += ` with ${waveHeight.toFixed(1)} foot faces`;
      }
    } else if (waveHeight >= 4.5) {
      report += `Chest to head high ${swellDir} swell, ${waveHeight.toFixed(1)} feet`;
    } else if (waveHeight >= 2.5) {
      report += `Waist to chest high waves from the ${swellDir}, around ${waveHeight.toFixed(1)} feet`;
    } else if (waveHeight >= 1.5) {
      report += `Knee to waist high surf, ${waveHeight.toFixed(1)} feet from the ${swellDir}`;
    } else if (waveHeight >= 0.5) {
      report += `Ankle to knee high ripples, barely ${waveHeight.toFixed(1)} feet`;
    } else {
      report += `Essentially flat, less than a foot`;
    }
    
    report += '. ';

    // WAVE PERIOD - Natural description (NO REDUNDANT "SECONDS")
    if (period >= 12) {
      report += `Long ${period.toFixed(0)}-second intervals mean powerful groundswell with clean sets and long rides.`;
    } else if (period >= 10) {
      report += `${period.toFixed(0)}-second period brings decent power and organized sets.`;
    } else if (period >= 8) {
      report += `${period.toFixed(0)}-second period gives moderate energy with reasonably spaced waves.`;
    } else if (period >= 6) {
      report += `Shorter ${period.toFixed(0)}-second period means more frequent but weaker waves.`;
    } else if (period > 0) {
      report += `Quick ${period.toFixed(0)}-second period, choppy wind swell with limited power.`;
    }

    report += '\n\n';

    // WIND - Conversational and informative (CLEAN MPH USAGE)
    if (isOffshore) {
      if (windSpeed < 5) {
        report += `Light ${windSpeed.toFixed(0)} mph ${windDir} breeze, glassy conditions.`;
      } else if (windSpeed < 10) {
        report += `${windSpeed.toFixed(0)} mph offshore ${windDir} wind grooming the faces nicely.`;
      } else if (windSpeed < 15) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} offshore holding up the faces but getting strong.`;
      } else if (windSpeed < 20) {
        report += `Strong ${windSpeed.toFixed(0)} mph ${windDir} offshore making it tough to paddle out.`;
      } else {
        report += `Howling ${windSpeed.toFixed(0)} mph ${windDir} offshore blowing the tops off.`;
      }
    } else {
      if (windSpeed < 5) {
        report += `Calm ${windSpeed.toFixed(0)} mph ${windDir} wind, minimal texture.`;
      } else if (windSpeed < 8) {
        report += `Light ${windSpeed.toFixed(0)} mph ${windDir} onshore adding slight chop.`;
      } else if (windSpeed < 12) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} onshore creating bumpy conditions.`;
      } else if (windSpeed < 18) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} onshore, pretty choppy out there.`;
      } else {
        report += `Strong ${windSpeed.toFixed(0)} mph ${windDir} onshore, blown out and messy.`;
      }
    }

    report += '\n\n';

    // WEATHER & WATER TEMP - Combined naturally (CLEAN DEGREE SYMBOLS)
    const airTempText = airTemp > 0 ? `${airTemp.toFixed(0)}°F` : '';
    const waterTempText = waterTemp > 0 ? `${waterTemp.toFixed(0)}°F` : '';
    
    if (airTempText && waterTempText) {
      report += `${weatherConditions} with ${airTempText} air and ${waterTempText} water. `;
    } else if (waterTempText) {
      report += `${weatherConditions}, water is ${waterTempText}. `;
    } else {
      report += `${weatherConditions}. `;
    }
    
    // Wetsuit recommendation
    if (waterTemp >= 75) {
      report += `Boardshorts weather.`;
    } else if (waterTemp >= 68) {
      report += `Spring suit or thin wetsuit recommended.`;
    } else if (waterTemp >= 60) {
      report += `3/2mm wetsuit will keep you comfortable.`;
    } else if (waterTemp >= 50) {
      report += `4/3mm wetsuit with booties needed.`;
    } else if (waterTemp > 0) {
      report += `5/4mm with hood, gloves, and booties, it's cold.`;
    }

    // TIDE - Simplified and actionable (CLEAN FORMATTING)
    if (tideData && tideData.length > 0) {
      report += '\n\n';
      
      const now = new Date();
      const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const currentTimeStr = estNow.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/New_York'
      });
      
      let tidePhase = '';
      for (let i = 0; i < tideData.length - 1; i++) {
        const currentTide = tideData[i];
        const nextTide = tideData[i + 1];
        
        if (currentTimeStr >= currentTide.time && currentTimeStr < nextTide.time) {
          if (currentTide.type.toLowerCase() === 'low') {
            tidePhase = `Tide is coming in`;
          } else {
            tidePhase = `Tide is going out`;
          }
          break;
        }
      }
      
      if (tidePhase) {
        report += `${tidePhase}. `;
      }
      
      const tideList = tideData.map(t => {
        const height = parseNumericValue(t.height, 0);
        return `${t.type} at ${t.time} (${height.toFixed(1)}ft)`;
      }).join(', ');
      
      report += `Tides today: ${tideList}.`;
      
      // Tide advice
      if (waveHeight >= 4) {
        report += ` Mid to high tide will be best for this size.`;
      } else if (waveHeight >= 2) {
        report += ` Mid tide usually works best.`;
      } else {
        report += ` Low to mid tide might give you the best shot.`;
      }
    }

    report += '\n\n';

    // RECOMMENDATION - Clear and actionable
    if (rating >= 8) {
      const recs = [
        `Get out there! This is what you've been waiting for.`,
        `Drop everything - these conditions are prime.`,
        `Don't miss this one. Everything is lining up.`,
      ];
      report += recs[seed % recs.length];
    } else if (rating >= 6) {
      const recs = [
        `Worth the paddle out. Should be a fun session.`,
        `Definitely surf-worthy if you've got time.`,
        `Good enough to make it worth your while.`,
      ];
      report += recs[seed % recs.length];
    } else if (rating >= 4) {
      const recs = [
        `Decent for beginners or longboarders. Mellow session vibes.`,
        `Small but rideable. Good for working on technique.`,
        `Not epic but you can catch waves. Perfect for learning.`,
      ];
      report += recs[seed % recs.length];
    } else {
      const recs = [
        `Save your energy for a better swell. Not much out there today.`,
        `Probably not worth it. Wait for conditions to improve.`,
        `Pretty minimal. Check back tomorrow or later this week.`,
      ];
      report += recs[seed % recs.length];
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
