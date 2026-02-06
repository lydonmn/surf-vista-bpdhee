
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Locations to process
const LOCATIONS = [
  { id: 'folly-beach', name: 'Folly Beach, SC' },
  { id: 'pawleys-island', name: 'Pawleys Island, SC' }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Daily 5AM Report] Starting report generation for all locations...');

    // Get current EST date
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = estDate.toISOString().split('T')[0];
    
    console.log('[Daily 5AM Report] Target date:', dateStr);
    console.log('[Daily 5AM Report] Current EST time:', estDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));

    const results = [];
    
    // Process each location
    for (const location of LOCATIONS) {
      console.log(`\n[Daily 5AM Report] Processing ${location.name}...`);
      
      const result = await processLocation(supabase, location.id, location.name, dateStr);
      results.push(result);
    }

    // Check if all locations succeeded
    const allSucceeded = results.every(r => r.success);
    const someSucceeded = results.some(r => r.success);

    if (allSucceeded) {
      console.log('[Daily 5AM Report] ✅ All locations processed successfully!');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Daily reports generated successfully for all locations',
          date: dateStr,
          results: results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (someSucceeded) {
      console.log('[Daily 5AM Report] ⚠️ Some locations succeeded, some failed');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Partial success - some locations failed',
          date: dateStr,
          results: results,
        }),
        { 
          status: 500,
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

async function processLocation(supabase: any, locationId: string, locationName: string, dateStr: string) {
  try {
    console.log(`[${locationName}] Checking if report already exists for today...`);
    
    // Check if we already have a valid report for today
    const { data: existingReport } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();

    if (existingReport && existingReport.wave_height !== 'N/A' && existingReport.conditions && existingReport.conditions.length > 100) {
      console.log(`[${locationName}] ✅ Valid report already exists for today - skipping`);
      return {
        success: true,
        location: locationName,
        locationId: locationId,
        message: 'Report already exists',
        skipped: true,
      };
    }

    console.log(`[${locationName}] Fetching fresh buoy data...`);

    // Step 1: Fetch fresh buoy data
    const { data: buoyData, error: buoyError } = await supabase.functions.invoke('fetch-surf-reports', {
      body: { location: locationId },
    });

    if (buoyError) {
      console.error(`[${locationName}] Buoy fetch failed:`, buoyError);
      throw new Error(`Buoy fetch failed: ${buoyError.message}`);
    }

    console.log(`[${locationName}] Buoy data response:`, buoyData);

    // Step 2: Check if we have valid wave data
    const { data: surfConditions, error: surfError } = await supabase
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

    // Check if wave data is valid (not N/A)
    const hasValidWaveData = surfConditions && 
      surfConditions.wave_height && 
      surfConditions.wave_height !== 'N/A' &&
      surfConditions.wave_height !== '' &&
      !isNaN(parseFloat(surfConditions.wave_height));

    if (!hasValidWaveData) {
      console.log(`[${locationName}] ❌ No valid wave data available. Wave height: ${surfConditions?.wave_height || 'null'}`);
      throw new Error('No valid wave data available from buoy');
    }

    console.log(`[${locationName}] ✅ Valid wave data found:`, {
      wave_height: surfConditions.wave_height,
      surf_height: surfConditions.surf_height,
      wave_period: surfConditions.wave_period,
      updated_at: surfConditions.updated_at,
    });

    // Step 3: Update weather data
    console.log(`[${locationName}] Fetching weather data...`);
    const { data: weatherResponse } = await supabase.functions.invoke('fetch-weather-data', {
      body: { location: locationId },
    });

    // Step 4: Update tide data
    console.log(`[${locationName}] Fetching tide data...`);
    const { data: tideResponse } = await supabase.functions.invoke('fetch-tide-data', {
      body: { location: locationId },
    });

    // Step 5: Generate the daily report with comprehensive narrative
    console.log(`[${locationName}] Generating daily report...`);
    
    // Get the capture time from surf_conditions
    const captureTime = surfConditions.updated_at 
      ? new Date(surfConditions.updated_at).toLocaleTimeString('en-US', { 
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true 
        })
      : '5:00 AM';

    // Fetch weather data for comprehensive narrative
    const { data: weatherData } = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();

    // Fetch tide data for comprehensive narrative
    const { data: tideDataArray } = await supabase
      .from('tide_data')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .order('time');

    // Generate comprehensive narrative with same logic as generate-daily-report
    const narrative = generateWittyNarrative(
      surfConditions, 
      captureTime, 
      dateStr,
      weatherData,
      tideDataArray || []
    );

    // Calculate surf rating (1-10)
    const rating = calculateSurfRating(surfConditions);

    // Insert or update the surf report
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

// Helper function to process a single location
async function processLocation(supabase: any, locationId: string, locationName: string, dateStr: string) {
  try {
    console.log(`[${locationName}] Checking if report already exists for today...`);
    
    // Check if we already have a valid report for today
    const { data: existingReport } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();

    if (existingReport && existingReport.wave_height !== 'N/A' && existingReport.conditions && existingReport.conditions.length > 100) {
      console.log(`[${locationName}] ✅ Valid report already exists for today - skipping`);
      return {
        success: true,
        location: locationName,
        locationId: locationId,
        message: 'Report already exists',
        skipped: true,
      };
    }

    console.log(`[${locationName}] Fetching fresh buoy data...`);
    
    // Step 1: Fetch fresh buoy data
    const { data: buoyData, error: buoyError } = await supabase.functions.invoke('fetch-surf-reports', {
      body: { location: locationId },
    });

    if (buoyError) {
      console.error(`[${locationName}] Buoy fetch failed:`, buoyError);
      throw new Error(`Buoy fetch failed: ${buoyError.message}`);
    }

    console.log(`[${locationName}] Buoy data response:`, buoyData);

    // Step 2: Check if we have valid wave data
    const { data: surfConditions, error: surfError } = await supabase
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

    // Check if wave data is valid (not N/A)
    const hasValidWaveData = surfConditions && 
      surfConditions.wave_height && 
      surfConditions.wave_height !== 'N/A' &&
      surfConditions.wave_height !== '' &&
      !isNaN(parseFloat(surfConditions.wave_height));

    if (!hasValidWaveData) {
      console.log(`[${locationName}] ❌ No valid wave data available. Wave height: ${surfConditions?.wave_height || 'null'}`);
      throw new Error('No valid wave data available from buoy');
    }

    console.log(`[${locationName}] ✅ Valid wave data found:`, {
      wave_height: surfConditions.wave_height,
      surf_height: surfConditions.surf_height,
      wave_period: surfConditions.wave_period,
      updated_at: surfConditions.updated_at,
    });

    // Step 3: Update weather data
    console.log(`[${locationName}] Fetching weather data...`);
    const { data: weatherResponse } = await supabase.functions.invoke('fetch-weather-data', {
      body: { location: locationId },
    });

    // Step 4: Update tide data
    console.log(`[${locationName}] Fetching tide data...`);
    const { data: tideResponse } = await supabase.functions.invoke('fetch-tide-data', {
      body: { location: locationId },
    });

    // Step 5: Generate the daily report with comprehensive narrative
    console.log(`[${locationName}] Generating daily report...`);
    
    // Get the capture time from surf_conditions
    const captureTime = surfConditions.updated_at 
      ? new Date(surfConditions.updated_at).toLocaleTimeString('en-US', { 
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true 
        })
      : '5:00 AM';

    // Fetch weather data for comprehensive narrative
    const { data: weatherData } = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();

    // Fetch tide data for comprehensive narrative
    const { data: tideDataArray } = await supabase
      .from('tide_data')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .order('time');

    // Generate comprehensive narrative with same logic as generate-daily-report
    const narrative = generateWittyNarrative(
      surfConditions, 
      captureTime, 
      dateStr,
      weatherData,
      tideDataArray || []
    );

    // Calculate surf rating (1-10)
    const rating = calculateSurfRating(surfConditions);

    // Insert or update the surf report
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

// Helper functions for robust narrative generation
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

// Generate comprehensive narrative with same logic as generate-daily-report
function generateWittyNarrative(
  surfConditions: any, 
  captureTime: string, 
  date: string,
  weatherData: any = null,
  tideData: any[] = []
): string {
  try {
    // ALWAYS use surf_height (rideable face) as the primary metric
    const rideableFaceStr = surfConditions.surf_height || surfConditions.wave_height;
    
    if (!rideableFaceStr || rideableFaceStr === 'N/A') {
      const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'Weather data unavailable';
      const windSpeed = surfConditions.wind_speed || 'N/A';
      const windDir = surfConditions.wind_direction || 'Variable';
      const waterTemp = surfConditions.water_temp || 'N/A';
      
      // Use date hash to ensure different locations get different messages
      const locationSeed = date.split('-').reduce((acc, val) => acc + parseInt(val), 0);
      const messages = [
        `The wave sensors on the buoy aren't reporting right now, so we can't give you rideable face heights or periods. The buoy is online though - winds are ${windSpeed} from the ${windDir}, water temp is ${waterTemp}, and weather is ${weatherConditions.toLowerCase()}. Check local surf cams or head to the beach to see what's actually happening out there!`,
        `Wave sensors are offline on the buoy today, so no wave data available. Wind is ${windSpeed} from the ${windDir}, water's at ${waterTemp}, and it's ${weatherConditions.toLowerCase()}. Your best bet is to check the beach in person or look at surf cams for current conditions.`,
        `Buoy wave sensors are down at the moment - can't pull rideable face data. However, wind conditions show ${windSpeed} from the ${windDir}, water temperature is ${waterTemp}, and the weather is ${weatherConditions.toLowerCase()}. Recommend checking visual reports or heading down to scout it yourself.`,
      ];
      
      const index = locationSeed % messages.length;
      return messages[index];
    }
    
    const rideableFace = parseNumericValue(rideableFaceStr, 0);
    const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
    const windDir = surfConditions.wind_direction || 'Variable';
    const swellDir = surfConditions.swell_direction || 'Variable';
    const period = surfConditions.wave_period || 'N/A';
    const periodNum = parseNumericValue(period, 0);
    const waterTemp = surfConditions.water_temp || 'N/A';

    const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
    const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

    // Calculate rating for opening
    const rating = calculateSurfRating(surfConditions);

    // Use location and date to create unique narrative variations
    const locationSeed = date.split('-').reduce((acc, val) => acc + parseInt(val), 0) + (surfConditions.location === 'pawleys-island' ? 100 : 0);

    // Build the report with comprehensive details
    let report = '';

    // Opening based on rating with more context - varied by location
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

    // DETAILED SURF SIZE AND CONDITIONS - Always reference "rideable face"
    report += '\n\n🌊 SURF CONDITIONS: ';
    
    // Detailed rideable face description with varied phrasing
    if (rideableFace >= 7) {
      const descriptions = [
        `We're seeing a massive ${swellDir} swell with rideable faces stacking up overhead at ${rideableFaceStr} feet. `,
        `A powerful ${swellDir} swell is producing overhead rideable faces measuring ${rideableFaceStr} feet. `,
        `Significant ${swellDir} energy with rideable wave faces reaching ${rideableFaceStr} feet overhead. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        const cleanDescriptions = [
          `The faces are clean and well-formed, offering powerful rides with plenty of push. `,
          `Wave faces are pristine and organized, delivering powerful, makeable sections. `,
          `Clean, well-shaped faces providing excellent power and ride potential. `,
        ];
        report += cleanDescriptions[locationSeed % cleanDescriptions.length];
      } else {
        const choppyDescriptions = [
          `However, the wind is creating some texture on the faces, making it challenging but still rideable for experienced surfers. `,
          `Wind-affected faces add complexity, best suited for advanced surfers. `,
          `Some texture on the faces from wind, creating challenging but manageable conditions. `,
        ];
        report += choppyDescriptions[locationSeed % choppyDescriptions.length];
      }
    } else if (rideableFace >= 4.5) {
      const descriptions = [
        `A solid ${swellDir} swell is delivering chest to head high rideable faces at ${rideableFaceStr} feet. `,
        `Quality ${swellDir} swell producing rideable wave faces in the ${rideableFaceStr} foot range, chest to head high. `,
        `${swellDir} swell energy creating rideable faces measuring ${rideableFaceStr} feet from chest to overhead. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        const cleanDescriptions = [
          `The wave faces are glassy and well-shaped, perfect for carving and generating speed. `,
          `Clean, organized faces ideal for performance surfing and speed generation. `,
          `Glassy wave faces offering excellent shape for maneuvers. `,
        ];
        report += cleanDescriptions[locationSeed % cleanDescriptions.length];
      } else {
        const choppyDescriptions = [
          `There's some wind chop on the faces, but the size makes up for it with plenty of power. `,
          `Wind texture present on faces, though size compensates with good push. `,
          `Faces show some bump from wind, but power remains solid. `,
        ];
        report += choppyDescriptions[locationSeed % choppyDescriptions.length];
      }
    } else if (rideableFace >= 2) {
      const descriptions = [
        `A small ${swellDir} swell is producing waist to chest high rideable faces at ${rideableFaceStr} feet. `,
        `Modest ${swellDir} swell with rideable wave faces in the ${rideableFaceStr} foot range, waist to chest high. `,
        `${swellDir} swell creating rideable faces measuring ${rideableFaceStr} feet, waist to chest level. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        const cleanDescriptions = [
          `The conditions are clean and organized, ideal for practicing maneuvers and longboarding. `,
          `Clean, well-organized faces perfect for skill development and longboard sessions. `,
          `Smooth, organized wave faces great for technique work and cruising. `,
        ];
        report += cleanDescriptions[locationSeed % cleanDescriptions.length];
      } else {
        const choppyDescriptions = [
          `The wind is adding some bump to the faces, making it a bit choppy but still fun. `,
          `Wind-induced texture on faces creates bumpy but surfable conditions. `,
          `Some chop on the faces from wind, though still enjoyable. `,
        ];
        report += choppyDescriptions[locationSeed % choppyDescriptions.length];
      }
    } else if (rideableFace >= 1) {
      const descriptions = [
        `Minimal swell with ankle to knee high rideable faces at ${rideableFaceStr} feet. `,
        `Small energy producing rideable wave faces in the ${rideableFaceStr} foot range, ankle to knee high. `,
        `Limited swell creating rideable faces measuring ${rideableFaceStr} feet, ankle to knee level. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      if (isClean) {
        const cleanDescriptions = [
          `Despite the small size, the faces are smooth - perfect for beginners or longboard cruising. `,
          `Clean, small faces ideal for learning or mellow longboard sessions. `,
          `Smooth wave faces great for beginner practice or relaxed cruising. `,
        ];
        report += cleanDescriptions[locationSeed % cleanDescriptions.length];
      } else {
        const choppyDescriptions = [
          `The small size combined with wind chop makes it challenging, best for practicing pop-ups. `,
          `Wind texture on small faces creates tricky conditions, good for fundamentals practice. `,
          `Choppy small faces best suited for basic technique work. `,
        ];
        report += choppyDescriptions[locationSeed % choppyDescriptions.length];
      }
    } else {
      const descriptions = [
        `Very minimal swell with rideable faces barely reaching ankle high at ${rideableFaceStr} feet. `,
        `Extremely limited energy with rideable wave faces at ${rideableFaceStr} feet, barely ankle high. `,
        `Negligible swell producing rideable faces measuring ${rideableFaceStr} feet, ankle high or less. `,
      ];
      report += descriptions[locationSeed % descriptions.length];
      
      const alternatives = [
        `Better suited for swimming or stand-up paddleboarding than surfing today. `,
        `Consider alternative water activities like SUP or swimming. `,
        `Not ideal for surfing - better for other ocean activities. `,
      ];
      report += alternatives[locationSeed % alternatives.length];
    }

    // DETAILED WAVE PERIOD AND QUALITY - varied phrasing
    if (periodNum >= 12) {
      const periodDescriptions = [
        `The wave period is ${period} seconds, which is excellent - these are long-period groundswells that pack serious punch and create well-defined sets with clean intervals between waves. `,
        `At ${period} seconds, the wave period indicates premium groundswell energy with powerful, well-spaced sets. `,
        `Wave period of ${period} seconds shows quality long-interval swell with strong push and organized set patterns. `,
      ];
      report += periodDescriptions[locationSeed % periodDescriptions.length];
    } else if (periodNum >= 10) {
      const periodDescriptions = [
        `Wave period is ${period} seconds, indicating a good quality swell with decent power and organized sets. `,
        `At ${period} seconds, the period shows solid swell quality with respectable energy and set organization. `,
        `${period} second wave period reflects good swell characteristics with reliable power delivery. `,
      ];
      report += periodDescriptions[locationSeed % periodDescriptions.length];
    } else if (periodNum >= 8) {
      const periodDescriptions = [
        `Wave period is ${period} seconds, providing moderate energy with reasonably spaced sets. `,
        `At ${period} seconds, the period indicates moderate swell energy and acceptable set intervals. `,
        `${period} second wave period shows mid-range energy with decent set spacing. `,
      ];
      report += periodDescriptions[locationSeed % periodDescriptions.length];
    } else if (periodNum >= 6) {
      const periodDescriptions = [
        `Wave period is ${period} seconds, which is on the shorter side - expect more frequent but less powerful waves with shorter rides. `,
        `At ${period} seconds, the shorter period means more frequent waves but reduced power and ride length. `,
        `${period} second wave period indicates wind swell characteristics with limited power per wave. `,
      ];
      report += periodDescriptions[locationSeed % periodDescriptions.length];
    } else if (periodNum > 0) {
      const periodDescriptions = [
        `Short wave period at ${period} seconds means choppy, wind-driven waves with limited power and quick, bumpy rides. `,
        `At ${period} seconds, the brief period reflects wind-generated chop with minimal energy. `,
        `${period} second wave period shows wind swell with choppy conditions and limited ride potential. `,
      ];
      report += periodDescriptions[locationSeed % periodDescriptions.length];
    }

    // DETAILED WIND CONDITIONS
    report += '\n\n💨 WIND CONDITIONS: ';
    
    if (isOffshore) {
      if (windSpeed < 5) {
        report += `Nearly calm offshore winds at ${windSpeed} mph from the ${windDir} are creating pristine, glassy conditions. The wave faces are smooth as silk, allowing for maximum performance and clean barrels. `;
      } else if (windSpeed < 10) {
        report += `Light offshore winds at ${windSpeed} mph from the ${windDir} are grooming the wave faces beautifully. Expect clean, well-shaped waves with excellent form and hollow sections. `;
      } else if (windSpeed < 15) {
        report += `Moderate offshore winds at ${windSpeed} mph from the ${windDir} are holding up the wave faces and creating some nice barrel opportunities, though it might get a bit gusty. `;
      } else if (windSpeed < 20) {
        report += `Strong offshore winds at ${windSpeed} mph from the ${windDir} are blowing hard - while this cleans up the faces, it can make paddling out challenging and blow out the tops of waves. `;
      } else {
        report += `Very strong offshore winds at ${windSpeed} mph from the ${windDir} are creating difficult conditions. The wind is so strong it's blowing the tops off waves and making it hard to paddle. `;
      }
    } else {
      if (windSpeed < 5) {
        report += `Nearly calm onshore winds at ${windSpeed} mph from the ${windDir} aren't causing much texture. Conditions are relatively smooth despite the wind direction. `;
      } else if (windSpeed < 8) {
        report += `Light onshore winds at ${windSpeed} mph from the ${windDir} are adding slight texture to the faces but nothing too disruptive. Still very surfable. `;
      } else if (windSpeed < 12) {
        report += `Moderate onshore winds at ${windSpeed} mph from the ${windDir} are creating noticeable chop on the wave faces. Expect bumpy rides and less defined shape. `;
      } else if (windSpeed < 18) {
        report += `Strong onshore winds at ${windSpeed} mph from the ${windDir} are making conditions quite choppy and disorganized. The waves are breaking irregularly with lots of texture. `;
      } else {
        report += `Very strong onshore winds at ${windSpeed} mph from the ${windDir} are creating blown-out conditions. The waves are messy, choppy, and breaking unpredictably. `;
      }
    }

    // DETAILED WEATHER CONDITIONS
    if (weatherData) {
      report += '\n\n☀️ WEATHER: ';
      const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
      const temp = weatherData.temperature ? `${weatherData.temperature}°F` : 'temperature unavailable';
      
      report += `Current conditions are ${weatherConditions.toLowerCase()}`;
      if (weatherData.temperature) {
        report += ` with air temperature at ${temp}`;
      }
      report += `. Water temperature is ${waterTemp}, `;
      
      const waterTempNum = parseNumericValue(waterTemp, 0);
      if (waterTempNum >= 75) {
        report += `which is warm and comfortable - boardshorts or a spring suit will do. `;
      } else if (waterTempNum >= 68) {
        report += `which is pleasant - a spring suit or thin wetsuit recommended. `;
      } else if (waterTempNum >= 60) {
        report += `which is cool - a 3/2mm wetsuit is recommended for comfort. `;
      } else if (waterTempNum >= 50) {
        report += `which is cold - you'll want a 4/3mm wetsuit with booties. `;
      } else if (waterTempNum > 0) {
        report += `which is very cold - a 5/4mm wetsuit with hood, gloves, and booties is essential. `;
      }
    }

    // DETAILED TIDE INFORMATION
    if (tideData && tideData.length > 0) {
      report += '\n\n🌙 TIDE SCHEDULE: ';
      
      // Find current tide phase
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/New_York'
      });
      
      let currentTidePhase = '';
      for (let i = 0; i < tideData.length - 1; i++) {
        const currentTide = tideData[i];
        const nextTide = tideData[i + 1];
        
        if (currentTime >= currentTide.time && currentTime < nextTide.time) {
          if (currentTide.type.toLowerCase() === 'low') {
            currentTidePhase = `Currently on an incoming tide (rising from ${currentTide.height}${currentTide.height_unit} low to ${nextTide.height}${nextTide.height_unit} high at ${nextTide.time}). `;
          } else {
            currentTidePhase = `Currently on an outgoing tide (dropping from ${currentTide.height}${currentTide.height_unit} high to ${nextTide.height}${nextTide.height_unit} low at ${nextTide.time}). `;
          }
          break;
        }
      }
      
      report += currentTidePhase;
      report += `Today's tide schedule: `;
      
      const tideDescriptions = tideData.map(t => {
        const tideType = t.type.toLowerCase() === 'high' ? 'High' : 'Low';
        return `${tideType} tide at ${t.time} (${t.height}${t.height_unit})`;
      });
      
      report += tideDescriptions.join(', ');
      report += `. `;
      
      // Add tide advice
      if (surfHeight >= 4) {
        report += `With this size swell, mid to high tide will offer the best shape and power. `;
      } else if (surfHeight >= 2) {
        report += `Mid tide usually offers the best balance of wave shape and rideable sections. `;
      } else {
        report += `Low to mid tide might give you the best chance at catching the available waves. `;
      }
    }

    // COMPREHENSIVE CLOSING RECOMMENDATION
    report += '\n\n📋 RECOMMENDATION: ';
    
    if (rating >= 8) {
      const closings = [
        'Drop everything and get out here! These are the conditions you dream about - clean faces, good size, and perfect wind. This is a session you\'ll be talking about for weeks.',
        'This is the one you don\'t want to miss! Everything is lining up perfectly. Call in sick, skip the meeting, do whatever you need to do - you need to be in the water right now.',
        'Absolutely worth the session! Premium conditions like this don\'t come around often. The stars have aligned with size, wind, and tide all working together.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 6) {
      const closings = [
        'Definitely worth checking out if you\'ve got time. The conditions are solid and you\'ll get some quality rides. Bring your standard shortboard and enjoy the session.',
        'Should be a fun session. Nothing epic, but definitely good enough to make it worth your while. You\'ll get plenty of waves and have a good time out there.',
        'Worth the paddle out. The conditions are clean enough and there\'s enough size to make it enjoyable. A solid session awaits if you can make it.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 4) {
      const closings = [
        'Could be fun for beginners or longboarders. The small size and manageable conditions make it perfect for learning or cruising. Bring the log and enjoy some mellow rides.',
        'Decent for a mellow session. Don\'t expect anything epic, but if you\'re looking to get wet and practice your fundamentals, it\'s worth it. Great for working on technique.',
        'Not epic but rideable. If you\'re itching to surf and don\'t mind small waves, you can still have fun out there. Perfect for a casual session or teaching someone.',
      ];
      report += selectRandom(closings);
    } else {
      const closings = [
        'Maybe wait for the next swell. The conditions today are pretty minimal and you\'d probably have more fun doing something else. Check back tomorrow or later this week.',
        'Check back tomorrow, might be better. Today\'s not really worth the effort unless you\'re desperate to get wet. Save your energy for when conditions improve.',
        'Not really worth it today. The surf is too small and conditions aren\'t great. Better to wait for a better swell or spend your time on other activities.',
      ];
      report += selectRandom(closings);
    }

    return report;
  } catch (error) {
    console.error('Error generating narrative:', error);
    return 'Unable to generate surf report at this time. Please check back later.';
  }
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
