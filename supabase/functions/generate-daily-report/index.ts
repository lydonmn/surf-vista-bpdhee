
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

    // Fetch all the data we need
    console.log('Fetching surf conditions...');
    const surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    console.log('Surf conditions result:', {
      error: surfResult.error,
      hasData: !!surfResult.data,
    });

    console.log('Fetching weather data...');
    const weatherResult = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    console.log('Weather data result:', {
      error: weatherResult.error,
      hasData: !!weatherResult.data,
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
    });

    if (!surfData || !weatherData) {
      const missingData = [];
      if (!surfData) missingData.push('surf conditions');
      if (!weatherData) missingData.push('weather data');
      
      const errorMsg = `Missing required data for report generation: ${missingData.join(', ')}`;
      console.error(errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Generate tide summary
    const tideSummary = generateTideSummary(tideData);
    console.log('Tide summary:', tideSummary);

    // Calculate surf rating (1-10) - use surf_height if available, otherwise wave_height
    const rating = calculateSurfRating(surfData, weatherData);
    console.log('Calculated rating:', rating);

    // Generate report text with variety - ALWAYS generate new text
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating);
    console.log('Generated report text:', reportText);
    console.log('Report text length:', reportText.length);

    // Use surf_height for display if available, otherwise fall back to wave_height
    const displayHeight = surfData.surf_height || surfData.wave_height;

    // Create the surf report
    const surfReport = {
      date: today,
      wave_height: displayHeight, // Now using surf height (face height) for display
      wave_period: surfData.wave_period || 'N/A',
      swell_direction: surfData.swell_direction || 'N/A',
      wind_speed: surfData.wind_speed,
      wind_direction: surfData.wind_direction,
      water_temp: surfData.water_temp,
      tide: tideSummary,
      conditions: reportText,
      rating: rating,
      updated_at: new Date().toISOString(),
    };

    console.log('Storing surf report...');

    // Store the report
    const { data: insertData, error: reportError } = await supabase
      .from('surf_reports')
      .upsert(surfReport, { onConflict: 'date' })
      .select();

    if (reportError) {
      console.error('Error storing surf report:', reportError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store surf report in database',
          details: reportError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('Surf report stored successfully');
    console.log('=== GENERATE DAILY REPORT COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily surf report generated successfully for Folly Beach, SC',
        location: 'Folly Beach, SC',
        report: surfReport,
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

function generateTideSummary(tideData: any[]): string {
  if (tideData.length === 0) {
    return 'Tide data unavailable';
  }

  const tides = tideData.map(t => `${t.type} at ${t.time} (${t.height}${t.height_unit})`);
  return tides.join(', ');
}

function calculateSurfRating(surfData: any, weatherData: any): number {
  // Parse surf height (use surf_height if available, otherwise wave_height)
  const heightStr = surfData.surf_height || surfData.wave_height;
  const heightMatch = heightStr.match(/(\d+\.?\d*)/);
  const surfHeight = heightMatch ? parseFloat(heightMatch[1]) : 0;

  // Parse wind speed
  const windSpeedMatch = surfData.wind_speed.match(/(\d+)/);
  const windSpeed = windSpeedMatch ? parseInt(windSpeedMatch[1]) : 0;
  
  const windDir = surfData.wind_direction.toLowerCase();
  
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
  const periodMatch = surfData.wave_period.match(/(\d+)/);
  const period = periodMatch ? parseInt(periodMatch[1]) : 0;
  
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
}

// Truly random selection function using crypto for better randomness
function selectRandom<T>(array: T[]): T {
  // Use crypto.getRandomValues for true randomness
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const index = randomBuffer[0] % array.length;
  return array[index];
}

function generateReportText(surfData: any, weatherData: any, tideSummary: string, rating: number): string {
  // Use surf_height if available, otherwise wave_height
  const heightStr = surfData.surf_height || surfData.wave_height;
  const heightMatch = heightStr.match(/(\d+\.?\d*)/);
  const surfHeight = heightMatch ? parseFloat(heightMatch[1]) : 0;
  
  const windSpeedMatch = surfData.wind_speed.match(/(\d+)/);
  const windSpeed = windSpeedMatch ? parseInt(windSpeedMatch[1]) : 0;
  
  const windDir = surfData.wind_direction;
  const swellDir = surfData.swell_direction;
  const period = surfData.wave_period;
  const periodNum = parseInt(period.match(/(\d+)/)?.[1] || '0');

  // Log that we're generating a new narrative with true randomness
  console.log('Generating narrative with crypto-based randomness');
  console.log('Surf height:', surfHeight, 'Rating:', rating);

  // Determine if conditions are clean
  const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
  const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

  // EXPANDED opening phrases based on rating - MORE VARIETY!
  const openings = [
    { min: 8, phrases: [
      'Epic at Folly!', 'Firing today!', 'Pumping!', 'Score!', 'Overhead and clean!', 
      'Going off!', 'Absolutely firing!', 'Bombs away!', 'Maxing out!', 'Cranking!',
      'Nuking!', 'All-time conditions!', 'Legendary session ahead!', 'Perfection!',
      'Barrels for days!', 'Dream conditions!', 'Unreal out there!', 'Insane!',
      'Off the charts!', 'World-class today!', 'Firing on all cylinders!', 'Stacked!'
    ]},
    { min: 6, phrases: [
      'Decent waves.', 'Worth a paddle.', 'Looking good.', 'Rideable.', 'Solid session.',
      'Fun out there.', 'Nice sets.', 'Looking fun!', 'Quality waves.', 'Stoked!',
      'Good vibes.', 'Playful conditions.', 'Makeable waves.', 'Cruisy session.',
      'Enjoyable surf.', 'Plenty of rides.', 'Surfable for sure.', 'Good times!',
      'Waves on tap.', 'Decent shape.', 'Fun size.', 'Workable conditions.'
    ]},
    { min: 4, phrases: [
      'Small but clean.', 'Marginal.', 'Longboard day.', 'Mellow vibes.', 'Chill session.',
      'Beginner friendly.', 'Mini wave fun.', 'Cruiser conditions.', 'Soft and playful.',
      'Gentle rollers.', 'Learner-friendly.', 'Easy going.', 'Mellow magic.',
      'Foam board paradise.', 'Tiny but rideable.', 'Knee-high fun.', 'Soft peaks.'
    ]},
    { min: 0, phrases: [
      'Flat.', 'No surf.', 'Lake mode.', 'Rest day.', 'Check back later.', 'Zero energy.',
      'Skip it today.', 'Pancake flat.', 'Glassy but lifeless.', 'Nada.', 'Zilch.',
      'Dead calm.', 'Mirror finish.', 'Totally flat.', 'Nothing happening.', 'Flatline.'
    ]}
  ];

  // Select opening with true randomness
  let opening = 'Conditions at Folly.';
  for (const o of openings) {
    if (rating >= o.min) {
      opening = selectRandom(o.phrases);
      break;
    }
  }

  // Build concise, descriptive narrative (max 4 sentences)
  let report = `${opening} `;

  // Sentence 1: Wave description with rideability - EXPANDED VARIETY!
  if (surfHeight >= 7) {
    const waveDescriptions = isClean 
      ? [
          'Massive overhead sets rolling through', 'Overhead bombs detonating', 
          'Epic overhead perfection', 'Overhead barrels on tap', 'Huge clean walls stacking up',
          'Double overhead perfection', 'Towering clean peaks', 'Overhead juice flowing',
          'Massive clean faces', 'Overhead dreamland', 'Huge glassy walls',
          'Overhead perfection unfolding', 'Giant clean sets marching in',
          'Overhead barrels spinning', 'Massive groomed faces'
        ]
      : [
          'Overhead chaos out there', 'Big but messy conditions', 'Overhead but wind-torn',
          'Large and challenging surf', 'Overhead but choppy', 'Big and bumpy',
          'Overhead wind slop', 'Large but textured', 'Overhead madness',
          'Big and wild', 'Overhead but rough', 'Large and unruly'
        ];
    const waveDesc = selectRandom(waveDescriptions);
    const rideability = isClean 
      ? selectRandom([
          'Barrels on tap for experienced surfers.', 'Epic rides for skilled chargers.',
          'Advanced surfers will score big.', 'Experts only, but worth it.',
          'Serious barrels for the brave.', 'Heavy but makeable for pros.'
        ])
      : selectRandom([
          'Challenging conditions for advanced riders only.', 'Expert territory today.',
          'Big wave experience required.', 'Not for the faint of heart.',
          'Gnarly conditions, proceed with caution.', 'Heavy and unpredictable.'
        ]);
    report += `${waveDesc} at ${heightStr}. ${rideability} `;
  } else if (surfHeight >= 4.5) {
    const waveDescriptions = isClean 
      ? [
          'Chest-to-head high peelers', 'Solid shoulder-high sets', 'Clean head-high walls',
          'Pumping chest-high waves', 'Crispy shoulder-high faces', 'Glassy chest-high perfection',
          'Head-high gems', 'Shoulder-high beauties', 'Chest-high corduroy',
          'Head-high perfection', 'Shoulder-high rippable walls', 'Chest-high playgrounds',
          'Head-high butter', 'Shoulder-high fun machines', 'Chest-high stoke generators'
        ]
      : [
          'Chest-high but bumpy', 'Shoulder-high wind slop', 'Head-high but textured',
          'Chest-high with some chop', 'Shoulder-high but rough', 'Head-high but messy',
          'Chest-high wind waves', 'Shoulder-high texture', 'Head-high but choppy'
        ];
    const waveDesc = selectRandom(waveDescriptions);
    const rideability = isClean 
      ? selectRandom([
          'Great for all skill levels with plenty of makeable waves.', 
          'Fun for everyone, lots of rides available.',
          'Perfect conditions for progression.', 'Ideal for intermediate to advanced.',
          'Plenty of opportunities for all levels.', 'Rippable for most surfers.',
          'Makeable waves all around.', 'Fun size for the masses.'
        ])
      : selectRandom([
          'Workable for intermediates, but expect some bumps.', 
          'Rideable but challenging.', 'Doable for experienced surfers.',
          'Makeable if you pick your waves.', 'Intermediate level required.',
          'Some fun to be had if you work for it.'
        ]);
    report += `${waveDesc} at ${heightStr}. ${rideability} `;
  } else if (surfHeight >= 2) {
    const waveDescriptions = isClean 
      ? [
          'Waist-high fun waves', 'Knee-to-waist high peelers', 'Small but shapely sets',
          'Mellow waist-high rollers', 'Clean knee-high nuggets', 'Playful waist-high waves',
          'Thigh-high fun', 'Waist-high cruisers', 'Knee-high perfection',
          'Waist-high playgrounds', 'Thigh-high gems', 'Knee-high butter',
          'Waist-high rippable faces', 'Thigh-high fun machines'
        ]
      : [
          'Knee-high wind slop', 'Small and choppy', 'Waist-high but messy',
          'Tiny and textured', 'Ankle-biters with chop', 'Knee-high bumps',
          'Waist-high wind waves', 'Small but rough', 'Thigh-high texture'
        ];
    const waveDesc = selectRandom(waveDescriptions);
    const rideability = isClean 
      ? selectRandom([
          'Perfect for longboards and beginners.', 'Ideal for learning.',
          'Great for cruising and nose riding.', 'Longboard heaven.',
          'Beginner paradise.', 'Mellow fun for all.',
          'Cruisy conditions for learners.', 'Soft and forgiving.'
        ])
      : selectRandom([
          'Barely rideable, best for foam boards.', 'Tough conditions for small waves.',
          'Challenging for beginners.', 'Foam board territory.',
          'Hard to catch anything clean.', 'Minimal fun factor.'
        ]);
    report += `${waveDesc} at ${heightStr}. ${rideability} `;
  } else {
    const flatDescriptions = [
      'Pancake flat', 'Total lake mode', 'Zero energy', 'Glassy but lifeless',
      'Completely flat', 'Not a ripple in sight', 'Dead calm', 'Mirror finish',
      'Absolutely nothing', 'Flatline conditions', 'Zero swell', 'Nada happening',
      'Totally dead', 'Glassy nothingness', 'Flat as a board'
    ];
    const flatDesc = selectRandom(flatDescriptions);
    report += `${flatDesc} at ${heightStr}. ${selectRandom([
      'No rideable waves today.', 'Nothing to ride.', 'Zero surf.',
      'Come back tomorrow.', 'Not worth the paddle.', 'Skip it.'
    ])} `;
  }

  // Sentence 2: Wind and period conditions - MORE VARIETY!
  const windQuality = isOffshore 
    ? (windSpeed < 12 
        ? selectRandom(['light offshore grooming', 'gentle offshore winds', 'soft offshore breeze', 'offshore perfection', 'light offshore texture'])
        : selectRandom(['strong offshore winds', 'offshore howling', 'offshore gusts', 'offshore blowing hard', 'offshore cranking']))
    : (windSpeed < 10 
        ? selectRandom(['light onshore texture', 'gentle onshore breeze', 'soft onshore winds', 'mild onshore flow', 'light onshore ripple'])
        : selectRandom(['choppy onshore winds', 'onshore mess', 'onshore slop', 'onshore chaos', 'onshore destruction']));
  
  const periodQuality = periodNum >= 12 
    ? selectRandom(['long-interval groundswell', 'long-period swell', 'deep water swell', 'powerful groundswell', 'long-range swell'])
    : (periodNum >= 8 
        ? selectRandom(['moderate period', 'mid-range swell', 'decent interval', 'workable period', 'medium-period waves'])
        : selectRandom(['short-period wind swell', 'choppy wind swell', 'short-interval chop', 'wind-driven waves', 'short-period slop']));
  
  report += `${periodQuality.charAt(0).toUpperCase() + periodQuality.slice(1)} at ${period} from ${swellDir} with ${windQuality} at ${surfData.wind_speed} from ${windDir}. `;

  // Sentence 3: Weather and water temp - MORE VARIETY!
  const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
  const skyDescriptions = [
    'Sky:', 'Overhead:', 'Weather:', 'Conditions:', 'Above:', 'Skies:', 'Looking up:'
  ];
  const waterDescriptions = [
    'water at', 'H2O at', 'ocean temp', 'water temp', 'sea temp at', 'water sitting at'
  ];
  report += `${selectRandom(skyDescriptions)} ${weatherConditions}, ${selectRandom(waterDescriptions)} ${surfData.water_temp}. `;

  // Sentence 4: Closing recommendation based on rating - EXPANDED!
  const closings = {
    high: [
      'Get after it!', 'Don&apos;t miss this one.', 'Prime conditions.', 'Epic day ahead.',
      'Get out there now!', 'Drop everything!', 'Call in sick!', 'This is it!',
      'Go go go!', 'All hands on deck!', 'Paddle out immediately!', 'Don&apos;t sleep on this!',
      'Rare opportunity!', 'Once in a lifetime!', 'You&apos;ll regret missing this!',
      'Clear your schedule!', 'This is what we live for!', 'Legendary session awaits!'
    ],
    medium: [
      'Worth checking out.', 'Should be fun.', 'Decent session awaits.', 'Give it a go.',
      'Not bad at all.', 'Worth the paddle.', 'Could be fun.', 'Grab your board.',
      'Might score some waves.', 'Worth a look.', 'Could be worth it.',
      'Decent enough.', 'Better than nothing.', 'Some fun to be had.',
      'Worth the effort.', 'Could surprise you.', 'Give it a shot.'
    ],
    low: [
      'Maybe tomorrow.', 'Check back later.', 'Rest day vibes.', 'Better days coming.',
      'Patience pays off.', 'Save your energy.', 'Wait for it.', 'Not today.',
      'Skip this one.', 'Tomorrow looks better.', 'Hang tight.', 'Next swell incoming.',
      'Take a break.', 'Recharge for the next one.', 'Better waves ahead.',
      'Not worth the drive.', 'Stay home today.', 'Wait for the goods.'
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

  console.log('Generated unique narrative with crypto randomness');
  console.log('Report length:', report.length, 'characters');
  console.log('Sentence count:', report.split(/[.!?]+/).filter(s => s.trim().length > 0).length);
  console.log('Report preview:', report.substring(0, 150) + '...');

  return report;
}
