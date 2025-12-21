
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

  // EXPANDED variety arrays with MORE phrases for better randomization
  const openings = [
    { min: 8, phrases: ['Epic at Folly!', 'Firing today!', 'Get out there!', 'Pumping!', 'Score!', 'Stoked!', 'Solid day!', 'Prime time!'] },
    { min: 6, phrases: ['Decent waves.', 'Worth a paddle.', 'Looking good.', 'Rideable.', 'Not bad.', 'Solid session.', 'Fun out there.', 'Check it out.'] },
    { min: 4, phrases: ['Small but clean.', 'Marginal.', 'Tiny but rideable.', 'Better than nothing.', 'Knee-high fun.', 'Longboard day.', 'Mellow vibes.', 'Chill session.'] },
    { min: 0, phrases: ['Flat.', 'No surf.', 'Lake mode.', 'Patience.', 'Tomorrow maybe.', 'Rest day.', 'Yoga time.', 'Check back later.'] }
  ];

  const waveDescriptions = [
    { min: 7, clean: ['overhead sets', 'head-high bombs', 'proper waves', 'solid barrels', 'epic faces', 'firing peaks'], rough: ['big but junky', 'size without shape', 'powerful mess', 'heavy chop', 'wild sets', 'gnarly conditions'] },
    { min: 4, clean: ['chest-high fun', 'shoulder-high peelers', 'waist-to-chest', 'playful walls', 'clean faces', 'fun peaks'], rough: ['wind-affected', 'bumpy', 'textured', 'choppy', 'rough faces', 'challenging'] },
    { min: 2, clean: ['knee-high rollers', 'small but shapely', 'ankle-to-knee', 'tiny peelers', 'mini waves', 'gentle rollers'], rough: ['wind slop', 'choppy mess', 'barely rideable', 'blown out', 'mushy', 'weak chop'] },
    { min: 0, clean: ['flat', 'no swell', 'glassy lake', 'mirror surface', 'zero waves', 'dead calm'], rough: ['blown flat', 'nothing', 'nada', 'zilch', 'flatsville', 'no action'] }
  ];

  const windPhrases = {
    offshore_light: ['light offshore', 'gentle offshore breeze', 'offshore grooming', 'clean offshore', 'perfect wind', 'glassy conditions'],
    offshore_strong: ['strong offshore', 'howling offshore', 'offshore but gusty', 'breezy offshore', 'stiff offshore', 'offshore winds'],
    onshore_light: ['light onshore', 'slight texture', 'gentle onshore', 'soft onshore', 'mild onshore', 'barely onshore'],
    onshore_strong: ['blown out', 'choppy onshore', 'wind-ravaged', 'onshore mess', 'heavy onshore', 'strong onshore']
  };

  const periodComments = [
    { min: 12, phrases: ['Long-interval swell', 'Quality groundswell', 'Well-spaced sets', 'Clean period', 'Solid interval', 'Nice spacing'] },
    { min: 8, phrases: ['Moderate period', 'Decent interval', 'Fair spacing', 'Average period', 'Okay interval', 'Standard spacing'] },
    { min: 0, phrases: ['Short-period wind swell', 'Quick interval', 'Choppy period', 'Fast period', 'Wind swell', 'Rapid interval'] }
  ];

  // Select opening based on rating - USE TIMESTAMP FOR RANDOMIZATION
  const timestamp = Date.now();
  let opening = 'Conditions at Folly.';
  for (const o of openings) {
    if (rating >= o.min) {
      const index = timestamp % o.phrases.length;
      opening = o.phrases[index];
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
      const index = (timestamp + 1) % phrases.length;
      waveDesc = phrases[index];
      break;
    }
  }

  // Select wind phrase
  let windPhrase = '';
  if (isOffshore) {
    const phrases = windSpeed < 12 ? windPhrases.offshore_light : windPhrases.offshore_strong;
    const index = (timestamp + 2) % phrases.length;
    windPhrase = phrases[index];
  } else {
    const phrases = windSpeed < 10 ? windPhrases.onshore_light : windPhrases.onshore_strong;
    const index = (timestamp + 2) % phrases.length;
    windPhrase = phrases[index];
  }

  // Select period comment
  const periodNum = parseInt(period.match(/(\d+)/)?.[1] || '0');
  let periodComment = '';
  for (const pc of periodComments) {
    if (periodNum >= pc.min) {
      const index = (timestamp + 3) % pc.phrases.length;
      periodComment = pc.phrases[index];
      break;
    }
  }

  // Build the report with variety - ALWAYS DIFFERENT
  let report = `${opening} `;

  // Wave info
  report += `Surf is ${heightStr} with ${waveDesc}. `;
  
  // Period and direction
  report += `${periodComment} at ${period} from ${swellDir}. `;

  // Wind
  report += `${windPhrase.charAt(0).toUpperCase() + windPhrase.slice(1)} at ${surfData.wind_speed} from ${windDir}. `;

  // Water temp
  report += `Water&apos;s ${surfData.water_temp}. `;

  // Weather
  const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
  report += `${weatherConditions}. `;

  // Tide
  report += `Tides: ${tideSummary}.`;

  console.log('Generated narrative with timestamp seed:', timestamp);

  return report;
}
