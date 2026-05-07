
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Location-specific personality traits for narrative generation
const LOCATION_PERSONALITIES: Record<string, {
  nickname: string;
  fullName: string;
}> = {
  'folly-beach': {
    nickname: 'Folly Beach',
    fullName: 'Folly Beach, South Carolina'
  },
  'pawleys-island': {
    nickname: 'Pawleys Island',
    fullName: 'Pawleys Island, South Carolina'
  },
  'holden-beach-nc': {
    nickname: 'Holden Beach',
    fullName: 'Holden Beach, North Carolina'
  },
  'rexhame-beach,-massachusetts-': {
    nickname: 'Marshfield',
    fullName: 'Marshfield, Massachusetts'
  },
  'marshfield-ma': {
    nickname: 'Marshfield',
    fullName: 'Marshfield, Massachusetts'
  },
  'cisco-beach': {
    nickname: 'Cisco Beach',
    fullName: 'Cisco Beach, Nantucket'
  },
  'cisco-beach-nantucket': {
    nickname: 'Cisco Beach',
    fullName: 'Cisco Beach, Nantucket'
  },
  'jupiter-florida': {
    nickname: 'Jupiter Inlet',
    fullName: 'Jupiter Inlet, Florida'
  },
  'jupiter-inlet': {
    nickname: 'Jupiter Inlet',
    fullName: 'Jupiter Inlet, Florida'
  },
  'jupiter': {
    nickname: 'Jupiter Inlet',
    fullName: 'Jupiter Inlet, Florida'
  },
  'virginia-beach-va': {
    nickname: 'Virginia Beach Pier',
    fullName: 'Virginia Beach Pier, Virginia'
  },
  'virginia-beach-pier-va': {
    nickname: 'Virginia Beach Pier',
    fullName: 'Virginia Beach Pier, Virginia'
  },
  'stuart-rocks-florida': {
    nickname: 'The Rocks',
    fullName: 'The Rocks, Stuart, Florida'
  }
};

function getLocationPersonality(locationId: string) {
  return LOCATION_PERSONALITIES[locationId] || {
    nickname: locationId.replace(/-/g, ' '),
    fullName: locationId.replace(/-/g, ' ')
  };
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
  
  const cleaned = direction.replace(/[0-9°\s]+/g, '').trim();
  const normalized = cleaned.toUpperCase();
  
  const directionMap: Record<string, string> = {
    'N': 'N', 'NORTH': 'N',
    'NE': 'NE', 'NORTHEAST': 'NE',
    'E': 'E', 'EAST': 'E',
    'SE': 'SE', 'SOUTHEAST': 'SE',
    'S': 'S', 'SOUTH': 'S',
    'SW': 'SW', 'SOUTHWEST': 'SW',
    'W': 'W', 'WEST': 'W',
    'NW': 'NW', 'NORTHWEST': 'NW',
  };
  
  return directionMap[normalized] || cleaned || 'mixed';
}

// Build template-based narrative (used as fallback when AI is unavailable)
function buildTemplateNarrative(
  surfConditions: any,
  weatherData: any,
  locationId: string
): string {
  const personality = getLocationPersonality(locationId);
  const surfHeightStr = surfConditions.surf_height || surfConditions.wave_height;

  if (!surfHeightStr || surfHeightStr === 'N/A' || surfHeightStr === '') {
    const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
    const windDir = (surfConditions.wind_direction || 'variable').replace(/feet/gi, '').trim();
    const waterTemp = parseNumericValue(surfConditions.water_temp, 0);
    const conditions = weatherData?.conditions || weatherData?.short_forecast || 'conditions unknown';
    const windText = windSpeed > 0 ? `${windSpeed.toFixed(0)} mph ${windDir}` : 'calm';
    const waterText = waterTemp > 0 ? `${waterTemp.toFixed(0)}°F` : 'unknown temp';
    return `Wave sensors are offline at ${personality.nickname} today. Buoy is still reporting wind at ${windText}, water temp at ${waterText}, and ${conditions.toLowerCase()} skies. Check the beach cam or scout it in person for current wave conditions.`;
  }

  let waveHeight = 0;
  let waveHeightLow = 0;
  let waveHeightHigh = 0;

  if (surfHeightStr.includes('-')) {
    const parts = surfHeightStr.split('-');
    waveHeightLow = parseNumericValue(parts[0], 0);
    waveHeightHigh = parseNumericValue(parts[1], 0);
    waveHeight = (waveHeightLow + waveHeightHigh) / 2;
  } else {
    waveHeight = parseNumericValue(surfHeightStr, 0);
    waveHeightLow = waveHeight;
    waveHeightHigh = waveHeight;
  }

  if (waveHeight <= 0 || isNaN(waveHeight)) {
    return `Unable to generate surf report for ${personality.nickname}. Wave data is unavailable.`;
  }

  const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
  const windDir = (surfConditions.wind_direction || 'variable').replace(/feet/gi, '').trim();
  const swellDir = formatSwellDirection(surfConditions.swell_direction);
  const period = parseNumericValue(surfConditions.wave_period, 0);
  const waterTemp = parseNumericValue(surfConditions.water_temp, 0);
  const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');

  let narrative = '';

  if (waveHeight >= 8) {
    narrative += `${personality.nickname} is firing with overhead sets`;
  } else if (waveHeight >= 5) {
    narrative += `${personality.nickname} has solid head-high surf`;
  } else if (waveHeight >= 3) {
    narrative += `${personality.nickname} has fun chest to shoulder high waves`;
  } else if (waveHeight >= 1.5) {
    narrative += `${personality.nickname} has small waist-high surf`;
  } else {
    narrative += `${personality.nickname} is pretty flat with minimal surf`;
  }

  if (waveHeightLow !== waveHeightHigh) {
    narrative += ` running ${waveHeightLow.toFixed(1)}-${waveHeightHigh.toFixed(1)} feet`;
  } else {
    narrative += ` around ${waveHeight.toFixed(1)} feet`;
  }

  if (period >= 10) {
    narrative += `. ${period.toFixed(0)}-second period from the ${swellDir} brings quality groundswell`;
  } else if (period >= 8) {
    narrative += `. ${period.toFixed(0)}-second period from the ${swellDir} provides moderate energy`;
  } else if (period > 0) {
    narrative += `. Short ${period.toFixed(0)}-second period indicates choppy wind swell from the ${swellDir}`;
  }

  if (windSpeed > 0) {
    if (isOffshore) {
      if (windSpeed < 10) {
        narrative += `. ${windSpeed.toFixed(0)} mph ${windDir} offshore wind is grooming the faces`;
      } else {
        narrative += `. Strong ${windSpeed.toFixed(0)} mph ${windDir} offshore wind is cleaning up the faces nicely`;
      }
    } else {
      if (windSpeed < 10) {
        narrative += `. ${windSpeed.toFixed(0)} mph ${windDir} onshore adds some texture`;
      } else {
        narrative += `. ${windSpeed.toFixed(0)} mph ${windDir} onshore is creating choppy conditions`;
      }
    }
  }

  if (waterTemp > 0) {
    narrative += `. Water is ${waterTemp.toFixed(0)}°F`;
    if (waterTemp >= 75) {
      narrative += ` - boardshorts weather`;
    } else if (waterTemp >= 68) {
      narrative += ` - spring suit recommended`;
    } else if (waterTemp >= 60) {
      narrative += ` - 3/2mm wetsuit needed`;
    } else if (waterTemp >= 50) {
      narrative += ` - 4/3mm with booties`;
    } else {
      narrative += ` - 5/4mm with hood and gloves`;
    }
  }

  if (waveHeight >= 5 && isOffshore) {
    narrative += `. Don't miss this one - premium conditions`;
  } else if (waveHeight >= 3) {
    narrative += `. Worth the paddle out for a fun session`;
  } else if (waveHeight >= 1.5) {
    narrative += `. Good for longboarders and beginners`;
  } else {
    narrative += `. Save your energy for a better swell`;
  }

  narrative += '.';
  return narrative;
}

// Generate surf narrative using AI with style learning from narrative_edits, falling back to template
async function generateSurfNarrative(
  surfConditions: any,
  weatherData: any,
  locationId: string,
  supabase: any
): Promise<string> {
  console.log('[generateSurfNarrative] Starting narrative generation for:', locationId);

  const personality = getLocationPersonality(locationId);
  const surfHeightStr = surfConditions.surf_height || surfConditions.wave_height;

  const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
  const windDir = (surfConditions.wind_direction || 'variable').replace(/feet/gi, '').trim();
  const swellDir = formatSwellDirection(surfConditions.swell_direction);
  const period = parseNumericValue(surfConditions.wave_period, 0);
  const waterTemp = parseNumericValue(surfConditions.water_temp, 0);
  const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');

  let waveHeight = 0;
  let waveHeightLow = 0;
  let waveHeightHigh = 0;
  if (surfHeightStr && surfHeightStr !== 'N/A' && surfHeightStr !== '') {
    if (surfHeightStr.includes('-')) {
      const parts = surfHeightStr.split('-');
      waveHeightLow = parseNumericValue(parts[0], 0);
      waveHeightHigh = parseNumericValue(parts[1], 0);
      waveHeight = (waveHeightLow + waveHeightHigh) / 2;
    } else {
      waveHeight = parseNumericValue(surfHeightStr, 0);
      waveHeightLow = waveHeight;
      waveHeightHigh = waveHeight;
    }
  }

  const surfHeightDisplay = waveHeightLow !== waveHeightHigh
    ? `${waveHeightLow.toFixed(1)}-${waveHeightHigh.toFixed(1)}`
    : waveHeight.toFixed(1);

  const waveQualityDescription = waveHeight >= 5 && isOffshore
    ? 'excellent — solid surf with clean offshore conditions'
    : waveHeight >= 3 && isOffshore
    ? 'good — fun waves with light offshore grooming'
    : waveHeight >= 3
    ? 'decent — rideable but a bit textured'
    : waveHeight >= 1.5
    ? 'small but fun for beginners and longboarders'
    : 'very small, minimal surf';

  const aiKey = Deno.env.get('SPECULAR_AI_KEY');
  if (!aiKey) {
    console.log('[generateSurfNarrative] SPECULAR_AI_KEY not set — using template fallback');
    return buildTemplateNarrative(surfConditions, weatherData, locationId);
  }

  try {
    const { data: edits, error: editsError } = await supabase
      .from('narrative_edits')
      .select('original_narrative, edited_narrative, surf_conditions')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (editsError) {
      console.warn('[generateSurfNarrative] Could not fetch narrative_edits:', editsError.message);
    }

    let fewShotBlock = '';
    if (edits && edits.length > 0) {
      const examples = edits.map((edit: any, i: number) => {
        const condSummary = edit.surf_conditions
          ? JSON.stringify(edit.surf_conditions).substring(0, 200)
          : 'conditions not recorded';
        return `Example ${i + 1}:\nConditions: ${condSummary}\nReport: ${edit.edited_narrative}`;
      }).join('\n\n');
      fewShotBlock = `Here are examples of how the admin prefers reports to be written — match this style closely:\n\n${examples}`;
    }

    const systemPrompt = `You are a surf report writer for ${personality.fullName}. Write a concise, vivid surf conditions narrative in 2-4 sentences (200-350 characters). Be direct and informative — describe wave size, quality, wind effect, and water temp. Use surfer terminology naturally but don't be cheesy.\n\n${fewShotBlock ? fewShotBlock + '\n\n' : ''}IMPORTANT: Never use the phrase "holding up the waves". For strong offshore wind, say things like "cleaning up the faces", "grooming the lineup", "pitching the lips", or "creating glassy conditions".`;

    const userPrompt = `Write a surf report for ${personality.nickname} with these conditions:\n- Wave height: ${surfHeightDisplay} ft\n- Wave period: ${period > 0 ? `${period.toFixed(0)}s from the ${swellDir}` : 'unknown'}\n- Wind: ${windSpeed > 0 ? `${windSpeed.toFixed(0)} mph ${windDir} (${isOffshore ? 'offshore' : 'onshore'})` : 'calm'}\n- Water temp: ${waterTemp > 0 ? `${waterTemp.toFixed(0)}°F` : 'unknown'}\n- Overall feel: ${waveQualityDescription}`;

    console.log('[generateSurfNarrative] Calling AI gateway (few-shot examples:', edits?.length ?? 0, ')');

    const aiResponse = await fetch('https://ai.specular.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.warn('[generateSurfNarrative] AI gateway error:', aiResponse.status, errText);
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiJson = await aiResponse.json();
    const aiNarrative = aiJson?.choices?.[0]?.message?.content?.trim();

    if (!aiNarrative) {
      console.warn('[generateSurfNarrative] AI returned empty content — falling back to template');
      throw new Error('AI returned empty narrative');
    }

    console.log('[generateSurfNarrative] ✅ AI narrative generated:', aiNarrative.length, 'chars');
    console.log('[generateSurfNarrative] Preview:', aiNarrative.substring(0, 100));
    return aiNarrative;

  } catch (aiError: any) {
    console.warn('[generateSurfNarrative] AI failed, using template fallback:', aiError.message);
    return buildTemplateNarrative(surfConditions, weatherData, locationId);
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes

async function waitForFreshData(supabase: any, locationId: string, dateStr: string, maxRetries: number): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data } = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('location', locationId)
      .eq('date', dateStr)
      .maybeSingle();

    if (data) {
      console.log(`[${locationId}] Fresh data found on attempt ${attempt}`);
      return data;
    }

    if (attempt < maxRetries) {
      console.log(`[${locationId}] No fresh data yet (attempt ${attempt}/${maxRetries}), retrying in 2 minutes...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw new Error(`[${locationId}] No fresh surf data available after ${maxRetries} attempts`);
}

function calculateSurfRating(surfConditions: any): number {
  const surfHeightStr = surfConditions.surf_height || surfConditions.wave_height || '0';
  const periodStr = surfConditions.wave_period || '0';
  const windSpeedStr = surfConditions.wind_speed || '0';
  
  if (surfHeightStr === 'N/A' || surfHeightStr === '') {
    return 5;
  }
  
  let surfHeight = 0;
  if (surfHeightStr.includes('-')) {
    const parts = surfHeightStr.split('-');
    const low = parseNumericValue(parts[0], 0);
    const high = parseNumericValue(parts[1], 0);
    surfHeight = (low + high) / 2;
  } else {
    surfHeight = parseNumericValue(surfHeightStr, 0);
  }
  
  const period = parseNumericValue(periodStr, 0);
  const windSpeed = parseNumericValue(windSpeedStr, 0);
  const windDir = (surfConditions.wind_direction || '').toLowerCase();
  const isOffshore = windDir.includes('w') || windDir.includes('n');

  let rating = 3;

  // Height contribution
  if (surfHeight >= 6) rating += 5;
  else if (surfHeight >= 4) rating += 4;
  else if (surfHeight >= 3) rating += 3;
  else if (surfHeight >= 2) rating += 2;
  else if (surfHeight >= 1) rating += 1;
  else rating -= 1;

  // Period contribution
  if (period >= 12) rating += 2;
  else if (period >= 10) rating += 1;
  else if (period < 6 && period > 0) rating -= 1;

  // Wind contribution
  if (isOffshore) {
    if (windSpeed < 10) rating += 1;
  } else {
    if (windSpeed > 10) rating -= 2;
  }

  return Math.max(1, Math.min(10, Math.round(rating)));
}

async function processLocation(
  supabase: any,
  locationId: string,
  locationName: string,
  dateStr: string,
  isManualTrigger: boolean
) {
  try {
    console.log(`[${locationName}] Processing location: ${locationId}`);
    console.log(`[${locationName}] Date: ${dateStr}`);
    console.log(`[${locationName}] Manual trigger: ${isManualTrigger}`);
    
    // 🚨 NEW: Try to update forecast data first, but don't fail if it doesn't work
    let forecastUpdateSuccess = false;
    try {
      console.log(`[${locationName}] 📊 Attempting to update forecast data...`);
      
      const forecastResult = await supabase.functions.invoke('fetch-surf-forecast', {
        body: { 
          location: locationId,
          generateNarrative: false // We'll generate narrative ourselves
        },
      });
      
      if (forecastResult.error) {
        console.warn(`[${locationName}] ⚠️ Forecast update failed: ${forecastResult.error.message}`);
        console.log(`[${locationName}] 📝 Continuing with existing data...`);
      } else if (forecastResult.data?.success) {
        console.log(`[${locationName}] ✅ Forecast data updated successfully`);
        forecastUpdateSuccess = true;
      } else {
        console.warn(`[${locationName}] ⚠️ Forecast update returned unsuccessful response`);
        console.log(`[${locationName}] 📝 Continuing with existing data...`);
      }
    } catch (forecastError: any) {
      console.warn(`[${locationName}] ⚠️ Forecast update exception: ${forecastError.message}`);
      console.log(`[${locationName}] 📝 Continuing with existing data...`);
    }
    
    // Fetch today's surf conditions — retry up to MAX_RETRIES times with RETRY_DELAY_MS between attempts.
    // Never fall back to previous-day data; throw if fresh data is not available.
    console.log(`[${locationName}] Waiting for fresh surf_conditions for location:`, locationId, 'date:', dateStr);

    const surfData = await waitForFreshData(supabase, locationId, dateStr, MAX_RETRIES);

    console.log(`[${locationName}] ✅ Found fresh surf_conditions row for today (${dateStr})`);
    
    // Fetch latest weather data from database
    console.log(`[${locationName}] Querying weather_data for location:`, locationId);
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_data')
      .select('*')
      .eq('location', locationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (weatherError) {
      console.warn(`[${locationName}] Weather data not available:`, weatherError.message);
    }
    
    console.log(`[${locationName}] Weather data available:`, !!weatherData);
    
    // Generate narrative from existing data
    console.log(`[${locationName}] Generating narrative...`);
    const narrative = await generateSurfNarrative(surfData, weatherData, locationId, supabase);
    
    console.log(`[${locationName}] Narrative generated: ${narrative.length} characters`);
    console.log(`[${locationName}] Preview: ${narrative.substring(0, 100)}...`);
    
    // Calculate rating
    const rating = calculateSurfRating(surfData);
    console.log(`[${locationName}] Calculated rating: ${rating}/10`);
    
    // Update surf_reports table
    const reportData = {
      date: dateStr,
      location: locationId,
      wave_height: surfData.wave_height || 'N/A',
      surf_height: surfData.surf_height || surfData.wave_height || 'N/A',
      wave_period: surfData.wave_period || 'N/A',
      swell_direction: surfData.swell_direction || 'N/A',
      wind_speed: surfData.wind_speed || 'N/A',
      wind_direction: surfData.wind_direction || 'N/A',
      water_temp: surfData.water_temp || 'N/A',
      tide: 'See tide times',
      conditions: narrative,
      report_text: narrative,
      rating: rating,
      updated_at: new Date().toISOString(),
    };
    
    console.log(`[${locationName}] Saving report to database...`);
    
    const { error: upsertError } = await supabase
      .from('surf_reports')
      .upsert(reportData, { onConflict: 'date,location' });
    
    if (upsertError) {
      console.error(`[${locationName}] Error saving report:`, upsertError);
      throw new Error(`Failed to save report: ${upsertError.message}`);
    }
    
    console.log(`[${locationName}] ✅ Report saved successfully`);
    
    // Verify save
    const { data: verifyData } = await supabase
      .from('surf_reports')
      .select('id, conditions, report_text, rating')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();
    
    if (verifyData) {
      console.log(`[${locationName}] ✅ Verification: conditions=${verifyData.conditions?.length || 0} chars, rating=${verifyData.rating}`);
    }
    
    return {
      success: true,
      location: locationName,
      locationId: locationId,
      date: dateStr,
      rating: rating,
      narrativeLength: narrative.length,
      forecastUpdated: forecastUpdateSuccess,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Daily Report] Missing environment variables');
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetLocationId: string | null = null;
    let isManualTrigger = false;
    let sendNotificationsOverride = false;
    
    try {
      const body = await req.json();
      if (body.location) {
        targetLocationId = body.location;
        isManualTrigger = body.isManualTrigger === true;
        sendNotificationsOverride = body.sendNotifications === true;
        console.log('[Daily Report] Manual trigger for:', targetLocationId);
        if (sendNotificationsOverride) {
          console.log('[Daily Report] 📢 sendNotifications=true override — notifications will be sent despite manual trigger');
        }
      }
    } catch (e) {
      console.log('[Daily Report] Scheduled mode - processing all locations');
    }

    console.log('[Daily Report] ═══════════════════════════════════════');
    console.log('[Daily Report] 🌅 SIMPLIFIED NARRATIVE GENERATION');
    console.log('[Daily Report] Mode:', isManualTrigger ? 'MANUAL' : 'SCHEDULED');
    console.log('[Daily Report] ═══════════════════════════════════════');

    // Fetch active locations
    let locationsQuery = supabase
      .from('locations')
      .select('id, name, display_name')
      .eq('is_active', true);
    
    if (targetLocationId) {
      locationsQuery = locationsQuery.eq('id', targetLocationId);
    }
    
    const { data: locationsData, error: locationsError } = await locationsQuery.order('name');

    if (locationsError || !locationsData || locationsData.length === 0) {
      const errorMsg = targetLocationId 
        ? `Location '${targetLocationId}' not found or inactive`
        : 'No active locations found';
      console.error('[Daily Report]', errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Daily Report] Processing ${locationsData.length} location(s)`);

    // Get current EST date
    const now = new Date();
    const estDateString = now.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const [month, day, year] = estDateString.split('/');
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    console.log('[Daily Report] Target date:', dateStr);

    // Process all locations in parallel — each location has its own independent retry loop.
    // Promise.allSettled ensures one location's failure never blocks another.
    console.log(`[Daily Report] Processing ${locationsData.length} location(s) in parallel (max ${MAX_RETRIES} retries each, ${RETRY_DELAY_MS / 60000} min apart)`);

    const settled = await Promise.allSettled(
      locationsData.map((location: any) => {
        console.log(`[Daily Report] 📍 Starting ${location.display_name}`);
        return processLocation(supabase, location.id, location.display_name, dateStr, isManualTrigger);
      })
    );

    const results = settled.map((outcome, i) => {
      const location = locationsData[i];
      if (outcome.status === 'fulfilled') {
        const r = outcome.value;
        if (r.success) {
          console.log(`[Daily Report] ✅ ${location.display_name}: SUCCESS (rating: ${r.rating}/10, forecast: ${r.forecastUpdated ? 'updated' : 'existing data'})`);
        } else {
          console.log(`[Daily Report] ❌ ${location.display_name}: FAILED - ${r.error}`);
        }
        return r;
      } else {
        console.error(`[Daily Report] ❌ Exception for ${location.display_name}:`, outcome.reason?.message);
        return {
          success: false,
          location: location.display_name,
          locationId: location.id,
          error: `Exception: ${outcome.reason?.message}`,
        };
      }
    });

    const allSucceeded = results.every(r => r.success);
    const someSucceeded = results.some(r => r.success);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Daily Report] 📝 surf_reports generated: ${successCount}/${locationsData.length}`);

    // Send notifications in a separate pass, decoupled from report generation.
    // Only send for locations where fresh data WAS found and a report WAS successfully generated today.
    if (!isManualTrigger || sendNotificationsOverride) {
      console.log(`\n[Daily Report] ═══════════════════════════════════════`);
      const successfulResults = results.filter(r => r.success);
      console.log(`[Daily Report] 📢 NOTIFICATION PASS — ${successfulResults.length} location(s) with fresh data`);
      let notifAttempted = 0;
      let notifSucceeded = 0;

      for (const result of successfulResults) {
        notifAttempted++;
        console.log(`[Daily Report] 📢 Sending notification for ${result.location}...`);
        try {
          const notificationResult = await supabase.functions.invoke('send-daily-report-notifications', {
            body: { location: result.locationId, date: dateStr },
          });

          if (notificationResult.data?.success) {
            notifSucceeded++;
            console.log(`[Daily Report] ✅ ${result.location}: notifications sent (${notificationResult.data.notificationsSent ?? 'unknown'} recipients)`);
          } else {
            console.warn(`[Daily Report] ⚠️ ${result.location}: notification function returned unsuccessful`);
          }
        } catch (notifError: any) {
          console.error(`[Daily Report] ❌ ${result.location}: notification send failed:`, notifError.message);
          // Don't fail the overall process if notifications fail
        }
      }

      console.log(`[Daily Report] 📢 Notifications attempted: ${notifAttempted}, succeeded: ${notifSucceeded}`);
    } else {
      console.log(`[Daily Report] 📢 Notifications skipped (manual trigger without sendNotifications=true)`);
    }

    console.log('\n[Daily Report] ═══════════════════════════════════════');
    console.log('[Daily Report] 📊 FINAL RESULTS:');
    console.log(`[Daily Report] Total locations: ${results.length}`);
    console.log(`[Daily Report] ✅ Successful: ${successCount}`);
    console.log(`[Daily Report] ❌ Failed: ${failureCount}`);
    
    if (successCount > 0) {
      console.log('[Daily Report] Successful locations:');
      results.filter(r => r.success).forEach(r => {
        console.log(`[Daily Report]   ✅ ${r.location} (rating: ${r.rating}/10, forecast: ${r.forecastUpdated ? 'updated' : 'existing data'})`);
      });
    }
    
    if (failureCount > 0) {
      console.log('[Daily Report] Failed locations:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`[Daily Report]   ❌ ${r.location}: ${r.error}`);
      });
    }
    
    console.log('[Daily Report] ═══════════════════════════════════════');

    if (allSucceeded) {
      return new Response(
        JSON.stringify({
          success: true,
          message: targetLocationId 
            ? `Report generated successfully for ${locationsData[0].display_name}`
            : `All ${successCount} location reports generated successfully`,
          date: dateStr,
          totalLocations: results.length,
          successCount: successCount,
          failureCount: failureCount,
          results: results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (someSucceeded) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Partial success: ${successCount}/${results.length} locations succeeded. Daily report generation continued despite ${failureCount} failure(s).`,
          date: dateStr,
          totalLocations: results.length,
          successCount: successCount,
          failureCount: failureCount,
          results: results,
          warning: 'Some locations failed but the process continued',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: `All ${results.length} locations failed to generate reports`,
          date: dateStr,
          totalLocations: results.length,
          successCount: successCount,
          failureCount: failureCount,
          results: results,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[Daily Report] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
