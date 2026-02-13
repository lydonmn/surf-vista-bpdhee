
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

function parseNumericValue(value: string | null | undefined, defaultValue: number = 0): number {
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  const match = value.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

function formatSwellDirection(direction: string | null | undefined): string {
  if (!direction) return 'mixed';
  
  // Extract just the direction letters/words, remove any numbers or symbols
  const cleaned = direction.replace(/[0-9°\s]+/g, '').trim();
  
  // Normalize common variations
  const normalized = cleaned.toUpperCase();
  
  // Map to standard abbreviations
  const directionMap: Record<string, string> = {
    'N': 'N',
    'NORTH': 'N',
    'NE': 'NE',
    'NORTHEAST': 'NE',
    'E': 'E',
    'EAST': 'E',
    'SE': 'SE',
    'SOUTHEAST': 'SE',
    'S': 'S',
    'SOUTH': 'S',
    'SW': 'SW',
    'SOUTHWEST': 'SW',
    'W': 'W',
    'WEST': 'W',
    'NW': 'NW',
    'NORTHWEST': 'NW',
  };
  
  return directionMap[normalized] || cleaned || 'mixed';
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

function generateNoWaveDataReportText(weatherData: any, surfData: any, tideData: any[], locationId: string): string {
  const personality = getLocationPersonality(locationId);
  const windSpeed = parseNumericValue(surfData.wind_speed, 0);
  const windDir = surfData.wind_direction || 'variable';
  const waterTemp = parseNumericValue(surfData.water_temp, 0);
  const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'conditions unknown';
  
  const windText = windSpeed > 0 ? `${windSpeed.toFixed(0)} mph ${windDir}` : 'calm';
  const waterText = waterTemp > 0 ? `${waterTemp.toFixed(0)}°F` : 'unknown temp';
  
  const messages = [
    `The wave sensors are offline today at ${personality.nickname}, so we can't give you exact wave heights. The buoy is still reporting though - wind is ${windText}, water is ${waterText}, and it's ${weatherConditions.toLowerCase()}. Best bet is to check the beach cam or drive down to see what's actually out there.`,
    
    `Wave sensors aren't working at ${personality.nickname} right now. We've got wind at ${windText}, water temp at ${waterText}, and ${weatherConditions.toLowerCase()} skies, but no wave data. Check the local surf cam or head down to scout it yourself.`,
    
    `Buoy sensors are down at ${personality.nickname} today - no wave readings available. Wind is ${windText}, water's ${waterText}, weather is ${weatherConditions.toLowerCase()}. You'll need to eyeball it from the beach or check a surf cam for current conditions.`
  ];
  
  const seed = locationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Date.now() / 86400000);
  return messages[seed % messages.length];
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
      return generateNoWaveDataReportText(weatherData, surfConditions, tideData, locationId);
    }
    
    const waveHeight = parseNumericValue(rideableFaceStr, 0);
    const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
    const windDir = surfConditions.wind_direction || 'variable';
    const swellDir = formatSwellDirection(surfConditions.swell_direction);
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
        `Probably not worth it. Check back tomorrow or later this week.`,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetLocationId: string | null = null;
    let isManualTrigger = false;
    
    try {
      const body = await req.json();
      if (body.location) {
        targetLocationId = body.location;
        isManualTrigger = true;
        console.log('[Daily 5AM Report] Manual trigger mode - target:', targetLocationId);
      }
    } catch (e) {
      console.log('[Daily 5AM Report] Scheduled mode - processing all locations');
    }

    console.log('[Daily 5AM Report] ═══════════════════════════════════════');
    console.log('[Daily 5AM Report] 🌅 REPORT GENERATION STARTED');
    console.log(`[Daily 5AM Report] Mode: ${isManualTrigger ? 'MANUAL TRIGGER' : 'SCHEDULED 6AM RUN'}`);
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
      
      const result = await processLocation(supabase, location.id, location.display_name, dateStr, isManualTrigger);
      results.push(result);
      
      if (result.success) {
        console.log(`[Daily 5AM Report] ✅ ${location.display_name}: SUCCESS`);
        
        if (!result.skipped && !isManualTrigger) {
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
        } else if (isManualTrigger) {
          console.log(`[Daily 5AM Report] ℹ️ Skipping notifications (manual trigger)`);
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

  } catch (error: any) {
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

async function processLocation(
  supabase: any, 
  locationId: string, 
  locationName: string, 
  dateStr: string,
  isManualTrigger: boolean = false
) {
  const MAX_RETRIES = isManualTrigger ? 1 : 10; // Only 1 attempt for manual, 10 for scheduled
  const RETRY_DELAYS = [5000, 10000, 20000, 30000, 60000, 120000, 180000, 300000, 600000, 900000]; // Up to 15 min wait for scheduled
  
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

    // Step 1: Fetch weather data (with retry)
    console.log(`[${locationName}] Step 1: Fetching weather data...`);
    let weatherData = null;
    for (let weatherAttempt = 1; weatherAttempt <= 3; weatherAttempt++) {
      try {
        const { data: weatherResult, error: weatherError } = await supabase.functions.invoke('fetch-weather-data', {
          body: { location: locationId },
        });

        if (weatherError) {
          console.warn(`[${locationName}] Weather fetch attempt ${weatherAttempt} warning:`, weatherError);
        } else if (weatherResult?.success) {
          console.log(`[${locationName}] ✅ Weather data fetched on attempt ${weatherAttempt}`);
          
          await delay(1000);
          
          const { data: weatherDbData } = await supabase
            .from('weather_data')
            .select('*')
            .eq('date', dateStr)
            .eq('location', locationId)
            .maybeSingle();
          
          if (weatherDbData) {
            weatherData = weatherDbData;
            break;
          }
        }
        
        if (weatherAttempt < 3) {
          await delay(2000);
        }
      } catch (weatherError: any) {
        console.warn(`[${locationName}] Weather fetch attempt ${weatherAttempt} failed:`, weatherError);
      }
    }

    // Step 2: Fetch tide data (with retry)
    console.log(`[${locationName}] Step 2: Fetching tide data...`);
    let tideDataArray = [];
    for (let tideAttempt = 1; tideAttempt <= 3; tideAttempt++) {
      try {
        const { data: tideResult, error: tideError } = await supabase.functions.invoke('fetch-tide-data', {
          body: { location: locationId },
        });

        if (tideError) {
          console.warn(`[${locationName}] Tide fetch attempt ${tideAttempt} warning:`, tideError);
        } else if (tideResult?.success) {
          console.log(`[${locationName}] ✅ Tide data fetched on attempt ${tideAttempt}`);
          
          await delay(1000);
          
          const { data: tideDbData } = await supabase
            .from('tide_data')
            .select('*')
            .eq('date', dateStr)
            .eq('location', locationId)
            .order('time');
          
          if (tideDbData && tideDbData.length > 0) {
            tideDataArray = tideDbData;
            break;
          }
        }
        
        if (tideAttempt < 3) {
          await delay(2000);
        }
      } catch (tideError: any) {
        console.warn(`[${locationName}] Tide fetch attempt ${tideAttempt} failed:`, tideError);
      }
    }

    // Step 3: Fetch surf/buoy data with intelligent retry and fallback
    let lastError = null;
    let surfConditions = null;
    let usedFallbackData = false;
    
    console.log(`[${locationName}] Step 3: Fetching surf/buoy data...`);
    console.log(`[${locationName}] Mode: ${isManualTrigger ? 'MANUAL (use most recent available data)' : 'SCHEDULED (retry for fresh data)'}`);
    
    // MANUAL TRIGGER: Use most recent data from today (or yesterday as fallback)
    if (isManualTrigger) {
      console.log(`[${locationName}] 🔍 Manual trigger: Using most recent successfully pulled data...`);
      
      // Get the most recent data from today
      const { data: mostRecentData, error: recentError } = await supabase
        .from('surf_conditions')
        .select('*')
        .eq('location', locationId)
        .eq('date', dateStr)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentError) {
        console.error(`[${locationName}] Error fetching surf conditions:`, recentError);
        throw new Error(`Failed to fetch surf conditions: ${recentError.message}`);
      }
      
      if (mostRecentData) {
        console.log(`[${locationName}] ✅ Using most recent data from today (updated: ${mostRecentData.updated_at})`);
        console.log(`[${locationName}] Data details:`, {
          wave_height: mostRecentData.wave_height,
          surf_height: mostRecentData.surf_height,
          wind_speed: mostRecentData.wind_speed,
          water_temp: mostRecentData.water_temp
        });
        surfConditions = mostRecentData;
        usedFallbackData = true;
      } else {
        // No data at all for today - try yesterday as last resort
        console.log(`[${locationName}] ⚠️ No data found for today, checking yesterday...`);
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const { data: yesterdayData, error: yesterdayError } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', locationId)
          .eq('date', yesterdayStr)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (yesterdayError) {
          console.error(`[${locationName}] Error fetching yesterday's data:`, yesterdayError);
        }
        
        if (yesterdayData) {
          console.log(`[${locationName}] ✅ Using yesterday's data as fallback`);
          // Update the date to today so the report shows for today
          surfConditions = { ...yesterdayData, date: dateStr };
          usedFallbackData = true;
        } else {
          console.error(`[${locationName}] ❌ No surf data available for today or yesterday`);
          throw new Error('No surf data available for today or yesterday');
        }
      }
    } 
    // SCHEDULED TRIGGER: Retry logic for fresh data
    else {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[${locationName}] Attempt ${attempt}/${MAX_RETRIES}: Fetching buoy data...`);
          
          // Try to fetch fresh data
          const { data: buoyData, error: buoyError } = await supabase.functions.invoke('fetch-surf-reports', {
            body: { location: locationId },
          });

          if (buoyError) {
            console.warn(`[${locationName}] Attempt ${attempt}: Buoy fetch warning:`, buoyError);
          }

          await delay(2000);

          // Query for the most recent surf conditions for today
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

          // Check if we have valid data
          const hasWaveData = fetchedConditions && (
            (fetchedConditions.wave_height && fetchedConditions.wave_height !== 'N/A' && fetchedConditions.wave_height !== '') ||
            (fetchedConditions.surf_height && fetchedConditions.surf_height !== 'N/A' && fetchedConditions.surf_height !== '')
          );

          const hasBuoyData = fetchedConditions && (
            (fetchedConditions.wind_speed && fetchedConditions.wind_speed !== 'N/A') ||
            (fetchedConditions.water_temp && fetchedConditions.water_temp !== 'N/A')
          );

          // SUCCESS CASE: We have wave data
          if (hasWaveData) {
            console.log(`[${locationName}] ✅ Attempt ${attempt}: Valid wave data found!`);
            surfConditions = fetchedConditions;
            break;
          } 
          
          // PARTIAL DATA CASE: Buoy is online but wave sensors are offline
          else if (hasBuoyData) {
            console.log(`[${locationName}] ⚠️ Attempt ${attempt}: No wave data, but buoy is online (wind/temp available)`);
            
            // Reach max retries, use available data
            if (attempt === MAX_RETRIES) {
              console.log(`[${locationName}] ✅ Max retries reached: Proceeding with available buoy data (wave sensors offline)`);
              surfConditions = fetchedConditions;
              usedFallbackData = true;
              break;
            }
            
            lastError = `Wave sensors offline, retrying... (${attempt}/${MAX_RETRIES})`;
          } 
          
          // NO DATA CASE: Nothing available yet
          else {
            const errorMsg = `No valid buoy data available`;
            console.log(`[${locationName}] ⚠️ Attempt ${attempt}/${MAX_RETRIES}: ${errorMsg}`);
            lastError = errorMsg;
          }
          
          // Wait before next retry
          if (attempt < MAX_RETRIES) {
            const delayMs = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
            console.log(`[${locationName}] ⏳ Waiting ${delayMs/1000} seconds before retry...`);
            await delay(delayMs);
          }
        } catch (attemptError: any) {
          console.error(`[${locationName}] Attempt ${attempt} error:`, attemptError);
          lastError = attemptError.message;
          
          if (attempt < MAX_RETRIES) {
            const delayMs = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
            await delay(delayMs);
          }
        }
      }
    }

    // Final check: Do we have ANY data to work with?
    if (!surfConditions) {
      console.error(`[${locationName}] ❌ All attempts failed. Last error: ${lastError}`);
      throw new Error(`Failed to fetch surf data: ${lastError}`);
    }

    // ✅ CRITICAL FIX: Check if we have valid wave data in the surf conditions we're using
    const hasValidWaveData = surfConditions && (
      (surfConditions.wave_height && surfConditions.wave_height !== 'N/A' && surfConditions.wave_height !== '') ||
      (surfConditions.surf_height && surfConditions.surf_height !== 'N/A' && surfConditions.surf_height !== '')
    );

    console.log(`[${locationName}] Step 4: Generating daily report...`);
    console.log(`[${locationName}] Data source: ${usedFallbackData ? 'Most recent available data' : 'Fresh data'}`);
    console.log(`[${locationName}] Wave sensors status: ${hasValidWaveData ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`[${locationName}] Surf conditions to use:`, {
      wave_height: surfConditions.wave_height,
      surf_height: surfConditions.surf_height,
      wind_speed: surfConditions.wind_speed,
      water_temp: surfConditions.water_temp
    });
    
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
    console.log(`[${locationName}] Narrative preview: ${narrative.substring(0, 150)}...`);

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
      hasWaveData: hasValidWaveData,
      usedFallbackData: usedFallbackData,
    };

  } catch (error: any) {
    console.error(`[${locationName}] ❌ Failed:`, error.message);
    return {
      success: false,
      location: locationName,
      locationId: locationId,
      error: error.message,
    };
  }
}
