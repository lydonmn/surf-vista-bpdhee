
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get EST date
function getESTDate(): string {
  const now = new Date();
  // Convert to EST by subtracting 5 hours (EST is UTC-5)
  const estTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  const year = estTime.getUTCFullYear();
  const month = String(estTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(estTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

    // Calculate surf rating (1-10)
    const rating = calculateSurfRating(surfData, weatherData);
    console.log('Calculated rating:', rating);

    // Generate report text
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating);
    console.log('Generated report text length:', reportText.length);

    // Create the surf report
    const surfReport = {
      date: today,
      wave_height: surfData.wave_height,
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
  let rating = 5; // Start at middle

  // Parse wave height
  const waveHeightMatch = surfData.wave_height.match(/(\d+\.?\d*)/);
  const waveHeight = waveHeightMatch ? parseFloat(waveHeightMatch[1]) : 0;

  // Wave height scoring (0-10 ft range)
  if (waveHeight >= 3 && waveHeight <= 6) {
    rating += 2; // Ideal range
  } else if (waveHeight >= 2 && waveHeight < 3) {
    rating += 1; // Decent
  } else if (waveHeight > 6 && waveHeight <= 8) {
    rating += 1; // Big but manageable
  } else if (waveHeight < 2) {
    rating -= 2; // Too small
  } else if (waveHeight > 8) {
    rating -= 1; // Too big for most
  }

  // Wind scoring
  const windSpeedMatch = surfData.wind_speed.match(/(\d+)/);
  const windSpeed = windSpeedMatch ? parseInt(windSpeedMatch[1]) : 0;
  
  const windDir = surfData.wind_direction.toLowerCase();
  
  // Offshore winds (W, NW, N) are best
  if (windDir.includes('w') || windDir.includes('n')) {
    if (windSpeed < 15) {
      rating += 2; // Light offshore
    } else if (windSpeed < 20) {
      rating += 1; // Moderate offshore
    }
  } else if (windDir.includes('e') || windDir.includes('s')) {
    // Onshore winds (E, SE, S) are worse
    if (windSpeed > 15) {
      rating -= 2; // Strong onshore
    } else {
      rating -= 1; // Light onshore
    }
  }

  // Wave period scoring
  const periodMatch = surfData.wave_period.match(/(\d+)/);
  const period = periodMatch ? parseInt(periodMatch[1]) : 0;
  
  if (period >= 10) {
    rating += 1; // Long period = better waves
  } else if (period < 6) {
    rating -= 1; // Short period = choppy
  }

  // Clamp rating between 1 and 10
  return Math.max(1, Math.min(10, rating));
}

function generateReportText(surfData: any, weatherData: any, tideSummary: string, rating: number): string {
  const waveHeightMatch = surfData.wave_height.match(/(\d+\.?\d*)/);
  const waveHeight = waveHeightMatch ? parseFloat(waveHeightMatch[1]) : 0;
  
  const windSpeedMatch = surfData.wind_speed.match(/(\d+)/);
  const windSpeed = windSpeedMatch ? parseInt(windSpeedMatch[1]) : 0;
  
  const windDir = surfData.wind_direction;
  const swellDir = surfData.swell_direction;
  const period = surfData.wave_period;

  let report = '';

  // Overall assessment
  if (rating >= 8) {
    report += 'Excellent surf conditions today at Folly Beach! ';
  } else if (rating >= 6) {
    report += 'Good surf conditions at Folly Beach with rideable waves. ';
  } else if (rating >= 4) {
    report += 'Fair surf conditions at Folly Beach. ';
  } else {
    report += 'Poor surf conditions at Folly Beach today. ';
  }

  // Wave description
  if (waveHeight >= 4) {
    report += `Waves are running ${surfData.wave_height} with ${period} period from ${swellDir}. `;
  } else if (waveHeight >= 2) {
    report += `Waves are ${surfData.wave_height} with ${period} period from ${swellDir}. `;
  } else {
    report += `Small waves at ${surfData.wave_height} with ${period} period from ${swellDir}. `;
  }

  // Wind conditions
  if (windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n')) {
    if (windSpeed < 10) {
      report += `Light offshore winds from ${windDir} at ${surfData.wind_speed} creating clean conditions. `;
    } else if (windSpeed < 20) {
      report += `Offshore winds from ${windDir} at ${surfData.wind_speed} grooming the waves. `;
    } else {
      report += `Strong offshore winds from ${windDir} at ${surfData.wind_speed} may blow out the surf. `;
    }
  } else {
    if (windSpeed < 10) {
      report += `Light onshore winds from ${windDir} at ${surfData.wind_speed}. `;
    } else {
      report += `Onshore winds from ${windDir} at ${surfData.wind_speed} creating choppy conditions. `;
    }
  }

  // Water temperature
  report += `Water temperature is ${surfData.water_temp}. `;

  // Weather
  report += `${weatherData.short_forecast}. `;

  // Tide info
  report += `Tides: ${tideSummary}.`;

  return report;
}
