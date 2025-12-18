
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Generating daily surf report...');

    // Get current date in EST
    const estDate = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York' 
    });
    const today = new Date(estDate).toISOString().split('T')[0];

    // Fetch all the data we need
    const [surfResult, weatherResult, tideResult] = await Promise.all([
      supabase.from('surf_conditions').select('*').eq('date', today).maybeSingle(),
      supabase.from('weather_data').select('*').eq('date', today).maybeSingle(),
      supabase.from('tide_data').select('*').eq('date', today).order('time'),
    ]);

    if (surfResult.error) {
      console.error('Error fetching surf conditions:', surfResult.error);
      throw surfResult.error;
    }

    if (weatherResult.error) {
      console.error('Error fetching weather:', weatherResult.error);
      throw weatherResult.error;
    }

    if (tideResult.error) {
      console.error('Error fetching tides:', tideResult.error);
      throw tideResult.error;
    }

    const surfData = surfResult.data;
    const weatherData = weatherResult.data;
    const tideData = tideResult.data || [];

    if (!surfData || !weatherData) {
      throw new Error('Missing required data for report generation');
    }

    console.log('Data retrieved:', {
      hasSurf: !!surfData,
      hasWeather: !!weatherData,
      tideCount: tideData.length
    });

    // Generate tide summary
    const tideSummary = generateTideSummary(tideData);

    // Calculate surf rating (1-10)
    const rating = calculateSurfRating(surfData, weatherData);

    // Generate report text
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating);

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

    console.log('Generated surf report:', surfReport);

    // Store the report
    const { error: reportError } = await supabase
      .from('surf_reports')
      .upsert(surfReport, { onConflict: 'date' });

    if (reportError) {
      console.error('Error storing surf report:', reportError);
      throw reportError;
    }

    console.log('Daily surf report generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily surf report generated successfully',
        report: surfReport,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-daily-report:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    report += 'Excellent surf conditions today! ';
  } else if (rating >= 6) {
    report += 'Good surf conditions with rideable waves. ';
  } else if (rating >= 4) {
    report += 'Fair surf conditions. ';
  } else {
    report += 'Poor surf conditions today. ';
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
