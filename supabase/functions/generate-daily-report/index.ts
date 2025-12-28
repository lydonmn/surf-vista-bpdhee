
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
      data: surfResult.data,
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

    // Check if surf data is valid (not all N/A)
    const hasValidSurfData = surfData.wave_height !== 'N/A' || surfData.surf_height !== 'N/A';
    
    if (!hasValidSurfData) {
      console.warn('Surf data contains N/A values - buoy may be offline or not reporting');
      console.log('Surf data:', surfData);
      
      // Generate a report indicating no data available
      const noDataReport = {
        date: today,
        wave_height: 'N/A',
        wave_period: 'N/A',
        swell_direction: 'N/A',
        wind_speed: surfData.wind_speed || 'N/A',
        wind_direction: surfData.wind_direction || 'N/A',
        water_temp: surfData.water_temp || 'N/A',
        tide: generateTideSummary(tideData),
        conditions: generateNoDataReportText(weatherData, tideData),
        rating: 0,
        updated_at: new Date().toISOString(),
      };

      console.log('Storing no-data surf report...');

      const { data: insertData, error: reportError } = await supabase
        .from('surf_reports')
        .upsert(noDataReport, { onConflict: 'date' })
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

      console.log('No-data surf report stored successfully');
      console.log('=== GENERATE DAILY REPORT COMPLETED (NO DATA) ===');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Daily surf report generated (no buoy data available)',
          location: 'Folly Beach, SC',
          report: noDataReport,
          warning: 'Buoy data unavailable - report generated with limited information',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
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
    const displayHeight = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;

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

function generateNoDataReportText(weatherData: any, tideData: any[]): string {
  const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
  
  const messages = [
    `Hey folks, unfortunately the surf buoy is offline or not reporting data right now, so we can&apos;t give you accurate wave conditions. Weather-wise, we&apos;ve got ${weatherConditions.toLowerCase()}. Check back later for updated surf conditions, or head down to the beach to see for yourself!`,
    `Buoy data is currently unavailable, so we don&apos;t have wave height or period information at the moment. The weather is ${weatherConditions.toLowerCase()}. We&apos;ll update as soon as the buoy comes back online. In the meantime, your best bet is to check the beach in person.`,
    `No surf data available right now - the buoy seems to be offline. Weather conditions are ${weatherConditions.toLowerCase()}. We&apos;re monitoring the situation and will update when data becomes available. Consider checking local surf cams or heading to the beach to assess conditions yourself.`,
    `The NOAA buoy isn&apos;t reporting wave data at the moment, so we can&apos;t provide surf conditions. Current weather is ${weatherConditions.toLowerCase()}. Check back soon for updates, or take a drive to the beach to see what&apos;s happening out there.`,
  ];
  
  // Use crypto for random selection
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const index = randomBuffer[0] % messages.length;
  
  return messages[index];
}

function calculateSurfRating(surfData: any, weatherData: any): number {
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
  const heightStr = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;
  
  // If still N/A, use default values
  if (heightStr === 'N/A') {
    return generateNoDataReportText(weatherData, []);
  }
  
  const surfHeight = parseNumericValue(heightStr, 0);
  const surfHeightMax = surfHeight; // Simplified for now
  
  const windSpeed = parseNumericValue(surfData.wind_speed, 0);
  
  const windDir = surfData.wind_direction || 'Variable';
  const swellDir = surfData.swell_direction || 'Variable';
  const period = surfData.wave_period || 'N/A';
  const periodNum = parseNumericValue(period, 0);
  const waterTemp = surfData.water_temp || 'N/A';

  // Log that we're generating a new narrative with true randomness
  console.log('Generating conversational narrative with crypto-based randomness');
  console.log('Surf height:', surfHeight, 'Rating:', rating);

  // Determine if conditions are clean
  const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
  const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

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

  // Select opening with true randomness
  let opening = 'Checked the surf this morning.';
  for (const o of openings) {
    if (rating >= o.min) {
      opening = selectRandom(o.phrases);
      break;
    }
  }

  let report = `${opening} `;

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

  console.log('Generated conversational narrative with crypto randomness');
  console.log('Report length:', report.length, 'characters');
  console.log('Sentence count:', report.split(/[.!?]+/).filter(s => s.trim().length > 0).length);
  console.log('Report preview:', report.substring(0, 150) + '...');

  return report;
}
