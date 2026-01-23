
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getESTDate(): string {
  const now = new Date();
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = estDateString.split('/');
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

function parseNumericValue(value: string | null | undefined, defaultValue: number = 0): number {
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  const match = value.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

function calculateSurfRating(surfData: any, weatherData: any): number {
  try {
    const heightStr = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;
    
    if (heightStr === 'N/A') {
      return 0;
    }
    
    const surfHeight = parseNumericValue(heightStr, 0);
    const windSpeed = parseNumericValue(surfData.wind_speed, 0);
    const windDir = (surfData.wind_direction || '').toLowerCase();
    
    let conditions = 'clean';
    
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

    const period = parseNumericValue(surfData.wave_period, 0);
    
    if (period < 6 && conditions === 'clean') {
      conditions = 'moderate';
    } else if (period < 6 && conditions === 'moderate') {
      conditions = 'poor';
    }

    let rating = 0;

    if (surfHeight <= 1.5) {
      rating = conditions === 'clean' ? 2 : 1;
    } else if (surfHeight <= 3) {
      rating = conditions === 'clean' ? 4 : Math.max(2, 4 - Math.floor(windSpeed / 10));
    } else if (surfHeight > 3 && surfHeight < 4.5) {
      rating = conditions === 'clean' ? 6 : 4;
    } else if (surfHeight >= 4.5 && surfHeight <= 6) {
      if (conditions === 'clean') {
        rating = 8;
      } else if (conditions === 'moderate') {
        rating = 7;
      } else if (conditions === 'moderately poor') {
        rating = 6;
      } else if (conditions === 'poor') {
        rating = 5;
      } else if (conditions === 'very poor') {
        rating = 4;
      } else {
        rating = 6;
      }
    } else if (surfHeight >= 7) {
      if (conditions === 'clean') {
        rating = 10;
      } else if (conditions === 'moderate') {
        rating = 9;
      } else if (conditions === 'poor') {
        rating = 8;
      } else if (conditions === 'very poor') {
        rating = 7;
      } else {
        rating = 8;
      }
    }

    rating = Math.max(1, Math.min(10, rating));
    
    return rating;
  } catch (error) {
    console.error('Error calculating surf rating:', error);
    return 5;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATE BUOY DATA ONLY STARTED ===');
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
          status: 200,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = getESTDate();
    console.log('Current EST date:', today);

    // Fetch the latest surf conditions for today
    const surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (surfResult.error) {
      console.error('Error fetching surf conditions:', surfResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch surf conditions',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const newSurfData = surfResult.data;

    // Check if we have valid wave data
    const hasValidWaveData = newSurfData && (newSurfData.wave_height !== 'N/A' || newSurfData.surf_height !== 'N/A');

    if (!hasValidWaveData) {
      console.log('No valid wave data available, looking for most recent successful data from today...');
      
      // Get the existing report for today
      const existingReportResult = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (existingReportResult.data && existingReportResult.data.wave_height !== 'N/A') {
        console.log('Keeping existing report with valid data from earlier today');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No new buoy data available, keeping existing report from today',
            report: existingReportResult.data,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      console.log('No valid data available for today');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid buoy data available',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get the existing report for today to preserve the narrative
    const existingReportResult = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (!existingReportResult.data) {
      console.log('No existing report found for today - this should only happen if the 5 AM report failed');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No existing report found for today. The 5 AM report generation may have failed.',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const existingReport = existingReportResult.data;

    // Fetch weather data for rating calculation
    const weatherResult = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    const weatherData = weatherResult.data;

    // Calculate new rating based on updated buoy data
    const newRating = weatherData ? calculateSurfRating(newSurfData, weatherData) : existingReport.rating;

    // Update only the buoy data fields, preserving the narrative (conditions field)
    const displayHeight = newSurfData.surf_height !== 'N/A' ? newSurfData.surf_height : newSurfData.wave_height;

    const updatedReport = {
      wave_height: displayHeight || 'N/A',
      wave_period: newSurfData.wave_period || 'N/A',
      swell_direction: newSurfData.swell_direction || 'N/A',
      wind_speed: newSurfData.wind_speed || 'N/A',
      wind_direction: newSurfData.wind_direction || 'N/A',
      water_temp: newSurfData.water_temp || 'N/A',
      rating: newRating,
      updated_at: new Date().toISOString(),
      // IMPORTANT: We do NOT update the 'conditions' field - this preserves the 5 AM narrative
    };

    console.log('Updating buoy data while preserving narrative:', updatedReport);

    const { data: updateData, error: updateError } = await supabase
      .from('surf_reports')
      .update(updatedReport)
      .eq('date', today)
      .select();

    if (updateError) {
      console.error('Error updating surf report:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update surf report',
          details: updateError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('=== UPDATE BUOY DATA ONLY COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Buoy data updated successfully (narrative preserved)',
        report: updateData[0],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== UPDATE BUOY DATA ONLY FAILED ===');
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
