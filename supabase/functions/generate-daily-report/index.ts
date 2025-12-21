
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

// Improved random selection function with better distribution
function selectRandom<T>(array: T[], seed: number): T {
  const index = Math.abs(seed) % array.length;
  return array[index];
}

// Generate a unique seed based on multiple factors
function generateUniqueSeed(surfData: any, weatherData: any): number {
  const now = Date.now();
  const heightStr = surfData.surf_height || surfData.wave_height;
  const heightMatch = heightStr.match(/(\d+\.?\d*)/);
  const height = heightMatch ? parseFloat(heightMatch[1]) : 0;
  const windSpeedMatch = surfData.wind_speed.match(/(\d+)/);
  const windSpeed = windSpeedMatch ? parseInt(windSpeedMatch[1]) : 0;
  
  // Create a unique seed combining timestamp, wave height, wind speed, and random factor
  const seed = now + (height * 1000) + (windSpeed * 100) + Math.floor(Math.random() * 10000);
  return seed;
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

  // Generate a truly unique seed for this report
  const baseSeed = generateUniqueSeed(surfData, weatherData);
  console.log('Using unique seed for narrative generation:', baseSeed);

  // MASSIVELY EXPANDED variety arrays with MANY MORE phrases for better randomization
  const openings = [
    { min: 8, phrases: [
      'Epic at Folly!', 'Firing today!', 'Get out there!', 'Pumping!', 'Score!', 'Stoked!', 
      'Solid day!', 'Prime time!', 'Go time!', 'Maxing out!', 'Absolutely cranking!',
      'Overhead and clean!', 'Barrels on tap!', 'Firing on all cylinders!', 'Proper surf!',
      'Unreal conditions!', 'Going off!', 'Absolutely firing!', 'Epic session ahead!', 'Bombs away!'
    ]},
    { min: 6, phrases: [
      'Decent waves.', 'Worth a paddle.', 'Looking good.', 'Rideable.', 'Not bad.', 
      'Solid session.', 'Fun out there.', 'Check it out.', 'Pretty good.', 'Nice sets.',
      'Quality waves rolling in.', 'Fun size today.', 'Shoulder-high fun.', 'Playful conditions.',
      'Good vibes.', 'Plenty of action.', 'Waves are working.', 'Decent shape.', 'Worth the paddle out.',
      'Fun little session.', 'Clean and fun.', 'Nice little swell.', 'Waves are on.', 'Looking fun!'
    ]},
    { min: 4, phrases: [
      'Small but clean.', 'Marginal.', 'Tiny but rideable.', 'Better than nothing.', 'Knee-high fun.', 
      'Longboard day.', 'Mellow vibes.', 'Chill session.', 'Cruisy.', 'Easy going.',
      'Small wave magic.', 'Ankle biters.', 'Minimal but makeable.', 'Soft and mellow.',
      'Beginner friendly.', 'Gentle rollers.', 'Waist-high at best.', 'Shortboard struggles.',
      'Foam board paradise.', 'Learner waves.', 'Tiny peelers.', 'Small but shapely.', 'Mini wave fun.'
    ]},
    { min: 0, phrases: [
      'Flat.', 'No surf.', 'Lake mode.', 'Patience.', 'Tomorrow maybe.', 'Rest day.', 
      'Yoga time.', 'Check back later.', 'Nada.', 'Zilch.', 'Glassy but flat.',
      'Zero energy.', 'Dead calm.', 'Flatsville.', 'Mirror surface.', 'No action.',
      'Pond-like.', 'Completely flat.', 'Nothing happening.', 'Skip it today.', 'Better days coming.'
    ]}
  ];

  const waveDescriptions = [
    { min: 7, clean: [
      'overhead sets', 'head-high bombs', 'proper waves', 'solid barrels', 'epic faces', 
      'firing peaks', 'heavy walls', 'pumping sets', 'double overhead beasts', 'powerful barrels',
      'grinding tubes', 'hollow sections', 'steep drops', 'critical waves', 'heavy lips',
      'barreling peaks', 'grinding walls', 'powerful sets', 'overhead perfection', 'firing barrels',
      'head-high perfection', 'proper groundswell', 'solid overhead', 'clean overhead sets'
    ], rough: [
      'big but junky', 'size without shape', 'powerful mess', 'heavy chop', 'wild sets', 
      'gnarly conditions', 'blown out beasts', 'chaotic surf', 'overhead chaos', 'big and bumpy',
      'powerful but messy', 'size but no shape', 'heavy and choppy', 'wild and woolly',
      'big but blown', 'overhead slop', 'powerful chop', 'big wind swell', 'heavy texture'
    ]},
    { min: 4, clean: [
      'chest-high fun', 'shoulder-high peelers', 'waist-to-chest', 'playful walls', 'clean faces', 
      'fun peaks', 'nice rollers', 'quality waves', 'shoulder-high perfection', 'chest-high gems',
      'fun-sized waves', 'playful peaks', 'makeable walls', 'rippable faces', 'fun little walls',
      'shoulder-high fun', 'chest-high peelers', 'waist-high perfection', 'fun-sized perfection',
      'playful little waves', 'clean little peaks', 'fun waist-high sets', 'shoulder-high gems'
    ], rough: [
      'wind-affected', 'bumpy', 'textured', 'choppy', 'rough faces', 'challenging', 
      'messy sets', 'wind-torn', 'bumpy and choppy', 'textured faces', 'wind-chopped',
      'rough and tumble', 'choppy mess', 'wind-affected peaks', 'bumpy walls', 'textured sets',
      'challenging conditions', 'wind-blown', 'rough little waves', 'choppy peaks'
    ]},
    { min: 2, clean: [
      'knee-high rollers', 'small but shapely', 'ankle-to-knee', 'tiny peelers', 'mini waves', 
      'gentle rollers', 'soft waves', 'mellow bumps', 'ankle-high perfection', 'tiny gems',
      'small clean waves', 'mini peelers', 'gentle little waves', 'soft rollers', 'mellow peaks',
      'tiny but clean', 'small shapely waves', 'gentle little rollers', 'soft little peaks',
      'mini clean waves', 'ankle-high fun', 'knee-high perfection', 'tiny clean sets'
    ], rough: [
      'wind slop', 'choppy mess', 'barely rideable', 'blown out', 'mushy', 'weak chop', 
      'textured mush', 'wind-chopped', 'sloppy little waves', 'choppy ankle biters',
      'wind-blown mush', 'barely makeable', 'weak and choppy', 'mushy mess', 'sloppy chop',
      'wind-affected slop', 'choppy little waves', 'barely surfable', 'weak wind slop'
    ]},
    { min: 0, clean: [
      'flat', 'no swell', 'glassy lake', 'mirror surface', 'zero waves', 'dead calm', 
      'glass off', 'pond-like', 'completely flat', 'no energy', 'mirror-like', 'zero action',
      'dead flat', 'glassy flatness', 'no movement', 'still water', 'calm surface'
    ], rough: [
      'blown flat', 'nothing', 'nada', 'zilch', 'flatsville', 'no action', 'zero energy', 
      'dead zone', 'completely dead', 'no waves at all', 'totally flat', 'zero surf',
      'nothing happening', 'dead water', 'no movement', 'flat as a pancake'
    ]}
  ];

  const windPhrases = {
    offshore_light: [
      'light offshore', 'gentle offshore breeze', 'offshore grooming', 'clean offshore', 
      'perfect wind', 'glassy conditions', 'offshore kiss', 'grooming breeze', 'light offshore winds',
      'gentle offshore', 'offshore perfection', 'clean offshore breeze', 'light grooming winds',
      'offshore and light', 'perfect offshore', 'gentle grooming breeze', 'light offshore flow',
      'offshore and clean', 'grooming offshore', 'light offshore conditions'
    ],
    offshore_strong: [
      'strong offshore', 'howling offshore', 'offshore but gusty', 'breezy offshore', 
      'stiff offshore', 'offshore winds', 'gusty offshore', 'offshore blast', 'strong offshore winds',
      'howling offshore breeze', 'gusty offshore winds', 'stiff offshore breeze', 'offshore gale',
      'strong offshore flow', 'breezy offshore conditions', 'offshore and gusty', 'stiff offshore winds'
    ],
    onshore_light: [
      'light onshore', 'slight texture', 'gentle onshore', 'soft onshore', 'mild onshore', 
      'barely onshore', 'subtle texture', 'light sea breeze', 'gentle onshore breeze',
      'light onshore winds', 'soft onshore breeze', 'mild onshore winds', 'barely onshore winds',
      'subtle onshore', 'light onshore flow', 'gentle sea breeze', 'soft onshore conditions'
    ],
    onshore_strong: [
      'blown out', 'choppy onshore', 'wind-ravaged', 'onshore mess', 'heavy onshore', 
      'strong onshore', 'onshore chaos', 'wind-torn', 'blown out conditions', 'strong onshore winds',
      'choppy onshore winds', 'heavy onshore breeze', 'onshore gale', 'wind-blown mess',
      'strong onshore flow', 'choppy onshore conditions', 'onshore and blown', 'heavy sea breeze'
    ]
  };

  const periodComments = [
    { min: 12, phrases: [
      'Long-interval swell', 'Quality groundswell', 'Well-spaced sets', 'Clean period', 
      'Solid interval', 'Nice spacing', 'Proper groundswell', 'Long-period energy',
      'Long-interval groundswell', 'Quality long-period swell', 'Well-spaced groundswell',
      'Clean long-period', 'Solid long-interval', 'Nice long-period spacing', 'Proper long-interval',
      'Long-period perfection', 'Quality interval', 'Well-spaced long-period', 'Clean groundswell'
    ]},
    { min: 8, phrases: [
      'Moderate period', 'Decent interval', 'Fair spacing', 'Average period', 'Okay interval', 
      'Standard spacing', 'Mid-range period', 'Reasonable interval', 'Moderate interval',
      'Decent period spacing', 'Fair interval', 'Average interval', 'Okay period',
      'Standard interval', 'Mid-range interval', 'Reasonable period', 'Moderate spacing'
    ]},
    { min: 0, phrases: [
      'Short-period wind swell', 'Quick interval', 'Choppy period', 'Fast period', 'Wind swell', 
      'Rapid interval', 'Close sets', 'Wind-driven chop', 'Short-interval wind swell',
      'Quick choppy period', 'Fast interval', 'Wind-driven swell', 'Rapid period',
      'Close-interval sets', 'Wind-generated chop', 'Short-period chop', 'Quick wind swell'
    ]}
  ];

  // Additional descriptive phrases for more variety
  const swellComments = [
    'Swell direction looking good.', 'Nice angle on the swell.', 'Swell hitting the beach well.',
    'Good swell window.', 'Swell wrapping nicely.', 'Favorable swell direction.',
    'Swell lines stacking up.', 'Clean swell energy.', 'Swell angle is prime.',
    'Swell direction is favorable.', 'Nice swell angle today.', 'Swell wrapping in nicely.',
    'Good swell direction.', 'Swell hitting perfectly.', 'Favorable swell angle.',
    'Swell lines looking good.', 'Clean swell direction.', 'Swell angle working well.',
    'Nice swell window.', 'Swell direction is solid.', 'Good swell angle today.'
  ];

  const waterTempComments = [
    'Water feels great.', 'Nice water temp.', 'Comfortable water.', 'Water&apos;s perfect.',
    'Good water temp.', 'Pleasant water.', 'Water&apos;s nice.', 'Decent water temp.',
    'Water temperature is comfortable.', 'Nice and warm.', 'Water&apos;s feeling good.',
    'Comfortable water temperature.', 'Water temp is pleasant.', 'Nice water temperature.',
    'Water&apos;s comfortable.', 'Good water temperature.', 'Pleasant water temp.',
    'Water feels comfortable.', 'Nice and comfortable.', 'Water temp feels good.'
  ];

  const rideabilityComments = {
    high: [
      'Waves are super rideable today.', 'Easy takeoffs and long rides.', 'Plenty of makeable waves.',
      'Waves are peeling perfectly.', 'Great for all skill levels.', 'Waves are working beautifully.',
      'Super fun and rideable.', 'Waves are peeling nicely.', 'Easy rides all around.',
      'Waves are very makeable.', 'Great rideability today.', 'Waves are peeling well.',
      'Super rideable conditions.', 'Easy waves to catch.', 'Waves are working great.',
      'Excellent rideability.', 'Waves are super fun.', 'Easy and fun waves.'
    ],
    medium: [
      'Waves are moderately rideable.', 'Some makeable sections.', 'Decent rideability.',
      'Waves are workable.', 'Fair rideability today.', 'Some fun waves to be found.',
      'Moderately rideable conditions.', 'Waves are somewhat makeable.', 'Decent wave quality.',
      'Fair wave rideability.', 'Some good sections.', 'Waves are okay to ride.',
      'Moderate wave quality.', 'Some rideable waves.', 'Fair conditions for riding.'
    ],
    low: [
      'Challenging conditions.', 'Difficult to find rideable waves.', 'Tough rideability.',
      'Waves are hard to ride.', 'Challenging wave conditions.', 'Difficult to make sections.',
      'Tough to find good waves.', 'Challenging rideability.', 'Hard to catch clean waves.',
      'Difficult conditions.', 'Tough wave quality.', 'Challenging to ride.',
      'Hard to find makeable waves.', 'Difficult rideability.', 'Tough conditions today.'
    ]
  };

  // Select opening based on rating - USE UNIQUE SEED
  let opening = 'Conditions at Folly.';
  for (const o of openings) {
    if (rating >= o.min) {
      opening = selectRandom(o.phrases, baseSeed);
      break;
    }
  }

  // Determine if conditions are clean
  const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
  const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

  // Select wave description
  let waveDesc = 'waves';
  for (const wd of waveDescriptions) {
    if (surfHeight >= wd.min) {
      const phrases = isClean ? wd.clean : wd.rough;
      waveDesc = selectRandom(phrases, baseSeed + 1);
      break;
    }
  }

  // Select wind phrase
  let windPhrase = '';
  if (isOffshore) {
    const phrases = windSpeed < 12 ? windPhrases.offshore_light : windPhrases.offshore_strong;
    windPhrase = selectRandom(phrases, baseSeed + 2);
  } else {
    const phrases = windSpeed < 10 ? windPhrases.onshore_light : windPhrases.onshore_strong;
    windPhrase = selectRandom(phrases, baseSeed + 2);
  }

  // Select period comment
  const periodNum = parseInt(period.match(/(\d+)/)?.[1] || '0');
  let periodComment = '';
  for (const pc of periodComments) {
    if (periodNum >= pc.min) {
      periodComment = selectRandom(pc.phrases, baseSeed + 3);
      break;
    }
  }

  // Select additional comments
  const swellComment = selectRandom(swellComments, baseSeed + 4);
  const waterComment = selectRandom(waterTempComments, baseSeed + 5);

  // Select rideability comment based on rating
  let rideabilityComment = '';
  if (rating >= 7) {
    rideabilityComment = selectRandom(rideabilityComments.high, baseSeed + 6);
  } else if (rating >= 4) {
    rideabilityComment = selectRandom(rideabilityComments.medium, baseSeed + 6);
  } else {
    rideabilityComment = selectRandom(rideabilityComments.low, baseSeed + 6);
  }

  // Build the report with MORE variety and focus on rideability
  let report = `${opening} `;

  // Wave info with rideability focus
  report += `Surf is running ${heightStr} with ${waveDesc}. ${rideabilityComment} `;
  
  // Period and direction with extra commentary
  report += `${periodComment} at ${period} from ${swellDir}. ${swellComment} `;

  // Wind with more context
  report += `Wind is ${windPhrase} at ${surfData.wind_speed} from ${windDir}. `;

  // Water temp with commentary
  report += `${waterComment} ${surfData.water_temp}. `;

  // Weather with more detail
  const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
  const weatherForecast = weatherData.forecast || weatherData.detailed_forecast || '';
  
  report += `Sky: ${weatherConditions}. `;
  
  // Add detailed forecast if available and not too long
  if (weatherForecast && weatherForecast.length < 200) {
    report += `${weatherForecast} `;
  }

  // Tide with context
  report += `Tides today: ${tideSummary}. `;

  // Add a closing comment based on rating
  const closingComments = {
    high: [
      'Get after it!', 'Don&apos;t miss this one.', 'Prime conditions.', 'Go surf!', 'Epic day ahead.',
      'Get out there now!', 'Don&apos;t sleep on this.', 'Prime time to surf.', 'Go get some!',
      'Epic session awaits.', 'Get on it!', 'Don&apos;t miss out.', 'Prime surf ahead.',
      'Go catch some waves!', 'Epic conditions today.', 'Get stoked!', 'Don&apos;t wait.',
      'Prime surf conditions.', 'Go shred!', 'Epic day to surf.'
    ],
    medium: [
      'Worth checking out.', 'Should be fun.', 'Decent session awaits.', 'Give it a go.', 'Not bad at all.',
      'Worth a look.', 'Should be decent.', 'Fair session ahead.', 'Give it a try.', 'Not too shabby.',
      'Worth the paddle.', 'Should be okay.', 'Decent waves await.', 'Give it a shot.', 'Not bad today.',
      'Worth checking.', 'Should be alright.', 'Fair conditions.', 'Give it a paddle.', 'Not bad out there.'
    ],
    low: [
      'Maybe tomorrow.', 'Check back later.', 'Patience pays off.', 'Rest day vibes.', 'Better days coming.',
      'Maybe next time.', 'Check back soon.', 'Patience is key.', 'Rest day today.', 'Better surf ahead.',
      'Maybe skip today.', 'Check back tomorrow.', 'Patience required.', 'Rest day recommended.', 'Better days ahead.',
      'Maybe wait.', 'Check back later today.', 'Patience needed.', 'Rest day mode.', 'Better conditions coming.'
    ]
  };

  let closingPhrase = '';
  if (rating >= 7) {
    closingPhrase = selectRandom(closingComments.high, baseSeed + 7);
  } else if (rating >= 4) {
    closingPhrase = selectRandom(closingComments.medium, baseSeed + 7);
  } else {
    closingPhrase = selectRandom(closingComments.low, baseSeed + 7);
  }

  report += closingPhrase;

  console.log('Generated narrative with unique seed:', baseSeed);
  console.log('Report length:', report.length, 'characters');
  console.log('Report preview:', report.substring(0, 100) + '...');

  return report;
}
