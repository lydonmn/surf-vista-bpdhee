
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  // Get EST time by using toLocaleString with America/New_York timezone
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the EST date string (format: MM/DD/YYYY)
  const [month, day, year] = estDateString.split('/');
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

// Helper function to safely parse numeric values from strings
function parseNumericValue(value: string | null | undefined, defaultValue: number = 0): number {
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  const match = value.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== GENERATE DAILY REPORT STARTED ===');
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
    
    // Use service role key for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Generating daily surf report for Folly Beach, SC...');

    // Get current date in EST
    const today = getESTDate();
    console.log('Current EST date:', today);
    console.log('Current UTC time:', new Date().toISOString());

    // Fetch all the data we need - try today first, then fall back to most recent
    console.log('Fetching surf conditions...');
    let surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    // If no data for today, get the most recent data
    if (!surfResult.data) {
      console.log('No surf data for today, fetching most recent...');
      surfResult = await supabase
        .from('surf_conditions')
        .select('*')
        .order('date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (surfResult.data) {
        console.log('Using surf data from:', surfResult.data.date);
      }
    }

    console.log('Surf conditions result:', {
      error: surfResult.error,
      hasData: !!surfResult.data,
      dataDate: surfResult.data?.date,
      waveHeight: surfResult.data?.wave_height,
      surfHeight: surfResult.data?.surf_height,
    });

    console.log('Fetching weather data...');
    let weatherResult = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    // If no weather for today, get most recent
    if (!weatherResult.data) {
      console.log('No weather data for today, fetching most recent...');
      weatherResult = await supabase
        .from('weather_data')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (weatherResult.data) {
        console.log('Using weather data from:', weatherResult.data.date);
      }
    }

    console.log('Weather data result:', {
      error: weatherResult.error,
      hasData: !!weatherResult.data,
      dataDate: weatherResult.data?.date,
    });

    console.log('Fetching tide data...');
    const tideResult = await supabase
      .from('tide_data')
      .select('*')
      .eq('date', today)
      .order('time');

    console.log('Tide data result:', {
      error: tideResult.error,
      count: tideResult.data?.length || 0,
    });

    if (surfResult.error) {
      console.error('Error fetching surf conditions:', surfResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch surf conditions',
          details: surfResult.error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (weatherResult.error) {
      console.error('Error fetching weather:', weatherResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch weather data',
          details: weatherResult.error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (tideResult.error) {
      console.error('Error fetching tides:', tideResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch tide data',
          details: tideResult.error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const surfData = surfResult.data;
    const weatherData = weatherResult.data;
    const tideData = tideResult.data || [];

    console.log('Data retrieved:', {
      hasSurf: !!surfData,
      hasWeather: !!weatherData,
      tideCount: tideData.length,
      surfDataDate: surfData?.date,
      weatherDataDate: weatherData?.date,
    });

    if (!surfData || !weatherData) {
      const missingData = [];
      if (!surfData) missingData.push('surf conditions');
      if (!weatherData) missingData.push('weather data');
      
      const errorMsg = `Missing required data for report generation: ${missingData.join(', ')}. Please run "Update All Data" first.`;
      console.error(errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          suggestion: 'Click "Update All Data" to fetch the latest surf and weather information.',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Check if surf data has valid wave measurements
    const hasValidWaveData = surfData.wave_height !== 'N/A' || surfData.surf_height !== 'N/A';
    
    // If no valid wave data today, check if we have recent valid data (within last 3 days)
    let recentValidSurfData = null;
    if (!hasValidWaveData) {
      console.log('No valid wave data for today, checking recent history...');
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
      
      const recentSurfResult = await supabase
        .from('surf_conditions')
        .select('*')
        .gte('date', threeDaysAgoStr)
        .neq('wave_height', 'N/A')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentSurfResult.data) {
        recentValidSurfData = recentSurfResult.data;
        console.log('Found recent valid surf data from:', recentValidSurfData.date);
      }
    }
    
    if (!hasValidWaveData && !recentValidSurfData) {
      console.warn('No valid wave data available - buoy wave sensors appear to be offline');
      console.log('Current surf data:', surfData);
      
      // Generate a report indicating wave sensors are offline but other data is available
      const tideSummary = generateTideSummary(tideData);
      const noWaveDataReport = {
        date: today,
        wave_height: 'N/A',
        wave_period: 'N/A',
        swell_direction: 'N/A',
        wind_speed: surfData.wind_speed || 'N/A',
        wind_direction: surfData.wind_direction || 'N/A',
        water_temp: surfData.water_temp || 'N/A',
        tide: tideSummary || 'Tide data unavailable',
        conditions: generateNoWaveDataReportText(weatherData, surfData, tideData),
        rating: 0,
        updated_at: new Date().toISOString(),
      };

      console.log('Storing no-wave-data surf report...');
      console.log('Report data:', JSON.stringify(noWaveDataReport, null, 2));

      // First, try to delete existing report for today
      const { error: deleteError } = await supabase
        .from('surf_reports')
        .delete()
        .eq('date', today);

      if (deleteError) {
        console.error('Error deleting old report:', deleteError);
      }

      // Then insert new report
      const { data: insertData, error: reportError } = await supabase
        .from('surf_reports')
        .insert(noWaveDataReport)
        .select();

      if (reportError) {
        console.error('Error storing surf report:', reportError);
        console.error('Full error details:', JSON.stringify(reportError, null, 2));
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to store surf report in database',
            details: reportError.message,
            hint: reportError.hint,
            code: reportError.code,
            reportData: noWaveDataReport,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      console.log('No-wave-data surf report stored successfully');
      console.log('=== GENERATE DAILY REPORT COMPLETED (NO WAVE DATA) ===');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Daily surf report generated (wave sensors offline)',
          location: 'Folly Beach, SC',
          report: noWaveDataReport,
          warning: 'Wave sensors offline - report generated with available data',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Use recent valid data if current data is N/A
    const effectiveSurfData = hasValidWaveData ? surfData : recentValidSurfData;
    const usingHistoricalData = !hasValidWaveData && recentValidSurfData;

    // Generate tide summary
    const tideSummary = generateTideSummary(tideData);
    console.log('Tide summary:', tideSummary);

    // Calculate surf rating (1-10) - use surf_height if available, otherwise wave_height
    const rating = calculateSurfRating(effectiveSurfData, weatherData);
    console.log('Calculated rating:', rating);

    // Generate report text with variety - ALWAYS generate new text
    const reportText = generateReportText(
      effectiveSurfData, 
      weatherData, 
      tideSummary, 
      rating,
      usingHistoricalData ? effectiveSurfData.date : null
    );
    console.log('Generated report text:', reportText);
    console.log('Report text length:', reportText.length);

    // Use surf_height for display if available, otherwise fall back to wave_height
    const displayHeight = effectiveSurfData.surf_height !== 'N/A' ? effectiveSurfData.surf_height : effectiveSurfData.wave_height;

    // Create the surf report - ensure all required fields are present
    const surfReport = {
      date: today,
      wave_height: displayHeight || 'N/A',
      wave_period: effectiveSurfData.wave_period || 'N/A',
      swell_direction: effectiveSurfData.swell_direction || 'N/A',
      wind_speed: surfData.wind_speed || 'N/A', // Use current wind data
      wind_direction: surfData.wind_direction || 'N/A', // Use current wind data
      water_temp: surfData.water_temp || 'N/A', // Use current water temp
      tide: tideSummary || 'Tide data unavailable',
      conditions: reportText,
      rating: rating,
      updated_at: new Date().toISOString(),
    };

    console.log('Storing surf report...');
    console.log('Report data:', JSON.stringify(surfReport, null, 2));

    // First, try to delete existing report for today
    const { error: deleteError } = await supabase
      .from('surf_reports')
      .delete()
      .eq('date', today);

    if (deleteError) {
      console.error('Error deleting old report:', deleteError);
      // Continue anyway - the insert might still work
    } else {
      console.log('Old report deleted successfully');
    }

    // Then insert new report
    const { data: insertData, error: reportError } = await supabase
      .from('surf_reports')
      .insert(surfReport)
      .select();

    if (reportError) {
      console.error('Error storing surf report:', reportError);
      console.error('Full error details:', JSON.stringify(reportError, null, 2));
      console.error('Report data:', JSON.stringify(surfReport, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store surf report in database',
          details: reportError.message,
          hint: reportError.hint,
          code: reportError.code,
          reportData: surfReport,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('Surf report stored successfully');
    console.log('Inserted data:', JSON.stringify(insertData, null, 2));
    console.log('=== GENERATE DAILY REPORT COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily surf report generated successfully for Folly Beach, SC',
        location: 'Folly Beach, SC',
        report: surfReport,
        dataAge: usingHistoricalData 
          ? `Using wave data from ${effectiveSurfData.date} (current sensors offline)` 
          : surfData.date !== today 
          ? `Using surf data from ${surfData.date}` 
          : 'Using current data',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== GENERATE DAILY REPORT FAILED ===');
    console.error('Error in generate-daily-report:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'N/A');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : typeof error,
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

function generateTideSummary(tideData: any[]): string {
  if (tideData.length === 0) {
    return 'Tide data unavailable';
  }

  const tides = tideData.map(t => `${t.type} at ${t.time} (${t.height}${t.height_unit})`);
  return tides.join(', ');
}

function generateNoWaveDataReportText(weatherData: any, surfData: any, tideData: any[]): string {
  const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
  const windSpeed = surfData.wind_speed || 'N/A';
  const windDir = surfData.wind_direction || 'Variable';
  const waterTemp = surfData.water_temp || 'N/A';
  
  const messages = [
    `Hey folks, the wave sensors on the Edisto buoy aren&apos;t reporting right now, so we can&apos;t give you wave heights or periods. The buoy is online though - we&apos;re seeing ${windSpeed} winds from the ${windDir}, water temp is ${waterTemp}, and weather is ${weatherConditions.toLowerCase()}. Check local surf cams or head to the beach to see what&apos;s actually happening out there!`,
    `Wave sensors are offline on the buoy today, so no wave data available. But we do know the wind is ${windSpeed} from the ${windDir}, water&apos;s at ${waterTemp}, and it&apos;s ${weatherConditions.toLowerCase()}. Your best bet is to check the beach in person or look at surf cams for current conditions.`,
    `The Edisto buoy&apos;s wave sensors aren&apos;t working right now, so we can&apos;t tell you wave heights. Current conditions show ${windSpeed} winds from the ${windDir}, ${waterTemp} water, and ${weatherConditions.toLowerCase()}. Head down to the beach or check surf cams to see what&apos;s actually going on!`,
    `No wave data from the buoy today - sensors appear to be offline. We can tell you the wind is ${windSpeed} ${windDir}, water temp is ${waterTemp}, and weather is ${weatherConditions.toLowerCase()}. Check surf cams or take a drive to the beach to assess conditions yourself.`,
  ];
  
  // Use Date.now() for simpler randomness
  const index = Math.floor(Date.now() / 1000) % messages.length;
  
  return messages[index];
}

function calculateSurfRating(surfData: any, weatherData: any): number {
  try {
    // Parse surf height (use surf_height if available, otherwise wave_height)
    const heightStr = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;
    
    // If still N/A, return 0
    if (heightStr === 'N/A') {
      return 0;
    }
    
    const surfHeight = parseNumericValue(heightStr, 0);

    // Parse wind speed
    const windSpeed = parseNumericValue(surfData.wind_speed, 0);
    
    const windDir = (surfData.wind_direction || '').toLowerCase();
    
    // Determine conditions quality based on wind
    let conditions = 'clean';
    
    // Offshore winds (W, NW, N) are best
    if (windDir.includes('w') || windDir.includes('n')) {
      if (windSpeed < 10) {
        conditions = 'clean';
      } else if (windSpeed < 15) {
        conditions = 'clean';
      } else if (windSpeed < 20) {
        conditions = 'moderate';
      } else {
        conditions = 'poor';
      }
    } else if (windDir.includes('e') || windDir.includes('s')) {
      // Onshore winds (E, SE, S) are worse
      if (windSpeed < 8) {
        conditions = 'clean';
      } else if (windSpeed < 12) {
        conditions = 'moderately poor';
      } else if (windSpeed < 18) {
        conditions = 'poor';
      } else {
        conditions = 'very poor';
      }
    }

    // Wave period affects conditions
    const period = parseNumericValue(surfData.wave_period, 0);
    
    if (period < 6 && conditions === 'clean') {
      conditions = 'moderate'; // Short period = choppy even with good wind
    } else if (period < 6 && conditions === 'moderate') {
      conditions = 'poor';
    } else if (period < 6 && conditions === 'moderately poor') {
      conditions = 'poor';
    }

    console.log('Stoke rating calculation:', {
      surfHeight,
      windSpeed,
      windDir,
      period,
      conditions
    });

    // Apply stoke rating parameters based on SURF HEIGHT (not wave height)
    let rating = 0;

    // 1. Surf height 3ft or less: Max 3/10. If clean, then 3/10.
    if (surfHeight <= 3) {
      rating = conditions === 'clean' ? 3 : Math.min(3, Math.max(1, 3 - (windSpeed / 10)));
    }
    // 2. Surf height 4ft: Clean = 4/10. Rough = 3/10.
    else if (surfHeight > 3 && surfHeight < 4.5) {
      if (conditions === 'clean') {
        rating = 4;
      } else {
        rating = 3;
      }
    }
    // 3. Surf height 4-6ft: Clean = 7/10. Moderately poor to very poor = 3/10 to 6/10.
    else if (surfHeight >= 4.5 && surfHeight <= 6) {
      if (conditions === 'clean') {
        rating = 7;
      } else if (conditions === 'moderate') {
        rating = 6;
      } else if (conditions === 'moderately poor') {
        rating = 5;
      } else if (conditions === 'poor') {
        rating = 4;
      } else if (conditions === 'very poor') {
        rating = 3;
      } else {
        rating = 5; // Default for unknown conditions
      }
    }
    // 4. Surf height 7ft or higher: Clean = 10/10. Moderate to very poor = 6/10 to 8/10.
    else if (surfHeight >= 7) {
      if (conditions === 'clean') {
        rating = 10;
      } else if (conditions === 'moderate') {
        rating = 8;
      } else if (conditions === 'poor') {
        rating = 7;
      } else if (conditions === 'very poor') {
        rating = 6;
      } else {
        rating = 7; // Default for unknown conditions
      }
    }

    // Clamp rating between 1 and 10
    rating = Math.max(1, Math.min(10, rating));
    
    console.log('Final stoke rating:', rating);
    
    return rating;
  } catch (error) {
    console.error('Error calculating surf rating:', error);
    return 5; // Default to middle rating on error
  }
}

// Simple random selection using Date.now()
function selectRandom<T>(array: T[]): T {
  const index = Math.floor((Date.now() + Math.random() * 1000) / 100) % array.length;
  return array[index];
}

function generateReportText(
  surfData: any, 
  weatherData: any, 
  tideSummary: string, 
  rating: number,
  historicalDate: string | null = null
): string {
  try {
    // Use surf_height if available, otherwise wave_height
    const heightStr = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;
    
    // If still N/A, use default values
    if (heightStr === 'N/A') {
      return generateNoWaveDataReportText(weatherData, surfData, []);
    }
    
    const surfHeight = parseNumericValue(heightStr, 0);
    const surfHeightMax = surfHeight; // Simplified for now
    
    const windSpeed = parseNumericValue(surfData.wind_speed, 0);
    
    const windDir = surfData.wind_direction || 'Variable';
    const swellDir = surfData.swell_direction || 'Variable';
    const period = surfData.wave_period || 'N/A';
    const periodNum = parseNumericValue(period, 0);
    const waterTemp = surfData.water_temp || 'N/A';

    // Log that we're generating a new narrative
    console.log('Generating conversational narrative');
    console.log('Surf height:', surfHeight, 'Rating:', rating);
    console.log('Using historical data:', historicalDate || 'No');

    // Determine if conditions are clean
    const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
    const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

    // Add note about historical data if applicable
    let historicalNote = '';
    if (historicalDate) {
      historicalNote = ` (Note: Wave sensors are currently offline, using wave data from ${historicalDate}. Current wind and water conditions are up to date.)`;
    }

    // CONVERSATIONAL opening phrases - like a friend telling you about the surf
    const openings = [
      { min: 8, phrases: [
        'Yo, it&apos;s absolutely firing out there!', 'Dude, you gotta see this!', 
        'Holy smokes, it&apos;s going off!', 'Bro, drop everything and get out here!',
        'Man, this is what we&apos;ve been waiting for!', 'Seriously, it&apos;s pumping!',
        'No joke, it&apos;s epic today!', 'This is insane, get out here!',
        'You&apos;re not gonna believe this!', 'It&apos;s absolutely cranking!',
        'This is the day we&apos;ve been dreaming about!', 'Unreal conditions right now!'
      ]},
      { min: 6, phrases: [
        'Hey, it&apos;s looking pretty fun out there.', 'Not bad at all today!',
        'Yeah, there&apos;s some decent waves rolling through.', 'It&apos;s worth checking out for sure.',
        'Pretty solid session happening.', 'Some nice ones coming through.',
        'Looking good, you should paddle out.', 'Definitely rideable today.',
        'Some fun waves to be had.', 'Worth the drive for sure.'
      ]},
      { min: 4, phrases: [
        'It&apos;s small but clean, could be fun.', 'Pretty mellow out there today.',
        'Not much size but it&apos;s rideable.', 'Longboard conditions for sure.',
        'Small but shapely, good for beginners.', 'Chill vibes, nothing crazy.',
        'Tiny but clean, grab the log.', 'Mellow session if you&apos;re into it.'
      ]},
      { min: 0, phrases: [
        'Honestly, it&apos;s pretty flat.', 'Not much happening today.',
        'Yeah, it&apos;s basically a lake.', 'Save your energy, nothing out there.',
        'Flat as a pancake, maybe tomorrow.', 'Zero surf, check back later.'
      ]}
    ];

    // Select opening
    let opening = 'Checked the surf this morning.';
    for (const o of openings) {
      if (rating >= o.min) {
        opening = selectRandom(o.phrases);
        break;
      }
    }

    let report = `${opening}${historicalNote} `;

    // CONVERSATIONAL swell description - talk about what the swell is doing
    if (surfHeight >= 7) {
      const swellDescriptions = isClean 
        ? [
            `We&apos;ve got this massive ${swellDir} swell rolling in, waves are stacking up overhead and just peeling perfectly`,
            `There&apos;s a huge ${swellDir} groundswell hitting the beach, sets are coming through double overhead and super clean`,
            `Big ${swellDir} energy out there, waves are towering overhead with glassy faces`,
            `This ${swellDir} swell is pumping, overhead bombs just marching through like clockwork`,
            `Serious ${swellDir} juice today, waves are overhead and groomed to perfection`,
            `The ${swellDir} swell is maxing out, overhead sets with perfect shape`
          ]
        : [
            `There&apos;s a big ${swellDir} swell but the wind is tearing it apart, overhead but pretty messy`,
            `Huge ${swellDir} energy but it&apos;s getting blown out, overhead and choppy`,
            `The ${swellDir} swell is massive but conditions are rough, overhead but challenging`,
            `Big ${swellDir} waves but the wind is making it gnarly, overhead chaos`
          ];
      report += `${selectRandom(swellDescriptions)}. `;
      
      // Talk about rideability
      const rideability = isClean 
        ? selectRandom([
            `Honestly, if you can handle it, you&apos;re gonna get barreled`,
            `This is expert territory but the barrels are there if you want them`,
            `Heavy but makeable for experienced surfers, some serious tubes on offer`,
            `Not for beginners but if you know what you&apos;re doing, it&apos;s firing`,
            `Advanced riders are scoring big time right now`
          ])
        : selectRandom([
            `It&apos;s big and wild, only go out if you really know what you&apos;re doing`,
            `Challenging conditions, definitely not for everyone today`,
            `Heavy and unpredictable, proceed with caution`,
            `Expert level stuff, pretty gnarly out there`
          ]);
      report += `${rideability}. `;
    } else if (surfHeight >= 4.5) {
      const swellDescriptions = isClean 
        ? [
            `We&apos;ve got a nice ${swellDir} swell, waves are coming through chest to head high and looking super clean`,
            `The ${swellDir} swell is delivering some quality shoulder to head high sets with great shape`,
            `Really nice ${swellDir} energy, waves are chest high and peeling nicely`,
            `Solid ${swellDir} swell, sets are head high and just rippable`,
            `The ${swellDir} swell is pumping out some fun chest to shoulder high waves`,
            `Good ${swellDir} groundswell, waves are head high with clean faces`
          ]
        : [
            `There&apos;s a ${swellDir} swell but the wind is adding some texture, chest high but a bit bumpy`,
            `The ${swellDir} swell is shoulder to head high but conditions are choppy`,
            `Decent ${swellDir} energy but the wind is making it messy, still rideable though`,
            `Chest high ${swellDir} waves but you&apos;ll have to work around the chop`
          ];
      report += `${selectRandom(swellDescriptions)}. `;
      
      // Talk about rideability
      const rideability = isClean 
        ? selectRandom([
            `Perfect size for most people, tons of makeable waves out there`,
            `Everyone&apos;s getting waves, from intermediates to advanced`,
            `Great conditions for progression, lots of opportunities`,
            `Fun for all levels, plenty of rides to go around`,
            `This is that sweet spot size, super fun and rippable`
          ])
        : selectRandom([
            `Still rideable if you pick your waves, intermediate level should be fine`,
            `Workable conditions, just gotta be selective`,
            `Doable for experienced surfers, some fun to be had`,
            `Not perfect but definitely surfable if you work for it`
          ]);
      report += `${rideability}. `;
    } else if (surfHeight >= 2) {
      const swellDescriptions = isClean 
        ? [
            `Small ${swellDir} swell, waves are waist high and clean though`,
            `Mellow ${swellDir} energy, knee to waist high but shapely`,
            `Tiny ${swellDir} swell but the waves have nice shape, waist high`,
            `Small but fun ${swellDir} waves, thigh to waist high and clean`,
            `Little ${swellDir} swell, waves are knee high but peeling nicely`
          ]
        : [
            `Small ${swellDir} swell and the wind isn&apos;t helping, waist high but choppy`,
            `Tiny ${swellDir} waves with some texture, knee high and bumpy`,
            `Not much ${swellDir} energy and it&apos;s getting blown around, small and messy`
          ];
      report += `${selectRandom(swellDescriptions)}. `;
      
      // Talk about rideability
      const rideability = isClean 
        ? selectRandom([
            `Perfect for longboards, super cruisy and fun`,
            `Great for beginners, mellow and forgiving`,
            `Longboard heaven, nose riding conditions`,
            `Ideal for learning, soft and playful waves`,
            `Grab the log, it&apos;s perfect for cruising`
          ])
        : selectRandom([
            `Tough to catch anything clean, foam board territory`,
            `Barely rideable, maybe for beginners on soft tops`,
            `Not much fun factor with the chop, pretty challenging`
          ]);
      report += `${rideability}. `;
    } else {
      const flatDescriptions = [
        `Honestly, there&apos;s just no swell at all, it&apos;s completely flat`,
        `Zero energy in the water, not a wave in sight`,
        `It&apos;s like a lake out there, totally dead`,
        `No swell whatsoever, glassy but lifeless`,
        `Flat as can be, nothing happening`
      ];
      report += `${selectRandom(flatDescriptions)}. Not worth paddling out today. `;
    }

    // CONVERSATIONAL wind and period description
    const windDescriptions = isOffshore 
      ? (windSpeed < 12 
          ? [
              `The wind is ${windSpeed} mph ${windDir}, just lightly grooming the faces`,
              `We&apos;ve got this perfect offshore breeze at ${windSpeed} mph from the ${windDir}, cleaning everything up`,
              `Light ${windDir} winds at ${windSpeed} mph, just kissing the surface`,
              `Offshore at ${windSpeed} mph from the ${windDir}, making it super glassy`,
              `Nice ${windDir} breeze at ${windSpeed} mph, holding the faces up nicely`
            ]
          : [
              `The wind is howling offshore at ${windSpeed} mph from the ${windDir}, almost too much`,
              `Strong ${windDir} winds at ${windSpeed} mph, blowing pretty hard offshore`,
              `Offshore is cranking at ${windSpeed} mph ${windDir}, making it challenging`,
              `The ${windDir} wind is gusting to ${windSpeed} mph, pretty blustery`
            ])
      : (windSpeed < 10 
          ? [
              `There&apos;s a light onshore breeze at ${windSpeed} mph from the ${windDir}, adding a little texture`,
              `Gentle ${windDir} winds at ${windSpeed} mph, just barely onshore`,
              `Soft onshore at ${windSpeed} mph ${windDir}, not too bad`,
              `Light ${windDir} flow at ${windSpeed} mph, minimal impact`
            ]
          : [
              `The wind is onshore at ${windSpeed} mph from the ${windDir}, making it pretty choppy`,
              `Onshore winds at ${windSpeed} mph ${windDir}, definitely adding some slop`,
              `The ${windDir} wind is blowing ${windSpeed} mph straight onshore, pretty messy`,
              `Onshore at ${windSpeed} mph from the ${windDir}, tearing it up`
            ]);
    
    const periodDescriptions = periodNum >= 12 
      ? [
          `The swell period is ${period}, so these are long-interval groundswell waves with lots of power`,
          `We&apos;re seeing ${period} intervals, that&apos;s solid groundswell with good push`,
          `Period is ${period}, nice long-range swell energy`,
          `${period} on the period, that&apos;s quality groundswell`
        ]
      : (periodNum >= 8 
          ? [
              `The period is ${period}, decent mid-range swell`,
              `We&apos;ve got ${period} intervals, workable swell energy`,
              `Period is sitting at ${period}, moderate but rideable`,
              `${period} on the period, not bad at all`
            ]
          : [
              `The period is only ${period}, so it&apos;s short-interval wind swell, pretty choppy`,
              `We&apos;re seeing ${period} intervals, that&apos;s wind-driven chop`,
              `Period is just ${period}, short and junky`,
              `${period} on the period, wind swell for sure`
            ]);
    
    report += `${selectRandom(windDescriptions)}. ${selectRandom(periodDescriptions)}. `;

    // CONVERSATIONAL weather description
    const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
    const weatherDescriptions = [
      `Weather-wise, we&apos;ve got ${weatherConditions.toLowerCase()}`,
      `Looking up, it&apos;s ${weatherConditions.toLowerCase()}`,
      `The sky is ${weatherConditions.toLowerCase()}`,
      `Conditions overhead are ${weatherConditions.toLowerCase()}`,
      `Weather is ${weatherConditions.toLowerCase()}`
    ];
    
    const waterDescriptions = [
      `Water temp is ${waterTemp}, feels pretty good`,
      `Ocean is sitting at ${waterTemp}, not too bad`,
      `Water&apos;s ${waterTemp}, comfortable enough`,
      `Sea temp is ${waterTemp}, decent`,
      `Water feels like ${waterTemp}`
    ];
    
    report += `${selectRandom(weatherDescriptions)} and the ${selectRandom(waterDescriptions)}. `;

    // CONVERSATIONAL closing recommendation
    const closings = {
      high: [
        `Seriously, drop what you&apos;re doing and get out here!`,
        `This is the one you don&apos;t want to miss!`,
        `Call in sick, this is epic!`,
        `Get out here now, it&apos;s firing!`,
        `You&apos;ll regret not surfing this one!`,
        `This is what we live for, go go go!`,
        `Clear your schedule, this is it!`,
        `Don&apos;t sleep on this, it&apos;s legendary!`
      ],
      medium: [
        `Definitely worth checking out if you&apos;ve got time.`,
        `Should be a fun session, worth the paddle.`,
        `Not perfect but definitely worth it.`,
        `You&apos;ll probably have a good time out there.`,
        `Worth grabbing your board for sure.`,
        `Could be a decent session if you go.`,
        `Better than sitting at home, that&apos;s for sure.`
      ],
      low: [
        `Maybe wait for the next swell, this one&apos;s not worth it.`,
        `I&apos;d probably skip it today, save your energy.`,
        `Check back tomorrow, might be better.`,
        `Not really worth the drive honestly.`,
        `Better waves are coming, be patient.`,
        `Take a rest day, nothing special happening.`,
        `Wait for it, the next swell will be better.`
      ]
    };

    let closingPhrase = '';
    if (rating >= 7) {
      closingPhrase = selectRandom(closings.high);
    } else if (rating >= 4) {
      closingPhrase = selectRandom(closings.medium);
    } else {
      closingPhrase = selectRandom(closings.low);
    }

    report += closingPhrase;

    console.log('Generated conversational narrative');
    console.log('Report length:', report.length, 'characters');

    return report;
  } catch (error) {
    console.error('Error generating report text:', error);
    return 'Unable to generate surf report at this time. Please check back later.';
  }
}
