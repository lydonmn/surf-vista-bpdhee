
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cleanup function to remove old data from the database
 * This keeps the database clean and prevents it from growing indefinitely
 * 
 * AUTOMATIC DATE HANDLING:
 * - Automatically calculates the current date in EST timezone
 * - Removes data older than 7 days
 * - No manual date management required
 */

// Helper function to get EST date
function getESTDate(daysOffset: number = 0): string {
  const now = new Date();
  // Add days offset
  now.setDate(now.getDate() + daysOffset);
  
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== CLEANUP OLD REPORTS STARTED ===');
    console.log('Timestamp (UTC):', new Date().toISOString());
    
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

    // Get current date and cutoff date (7 days ago) in EST timezone
    const today = getESTDate();
    const cutoffDate = getESTDate(-7); // 7 days ago
    
    console.log('Current EST date:', today);
    console.log('Cutoff date (7 days ago):', cutoffDate);
    console.log('Deleting data older than:', cutoffDate);

    const results = {
      surfReports: 0,
      weatherData: 0,
      weatherForecast: 0,
      tideData: 0,
    };

    // Delete old surf reports (older than 7 days)
    console.log('Deleting old surf reports...');
    const { data: deletedReports, error: reportsError } = await supabase
      .from('surf_reports')
      .delete()
      .lt('date', cutoffDate)
      .select();

    if (reportsError) {
      console.error('Error deleting old surf reports:', reportsError);
    } else {
      results.surfReports = deletedReports?.length || 0;
      console.log(`Deleted ${results.surfReports} old surf reports`);
    }

    // Delete old weather data (older than 7 days)
    console.log('Deleting old weather data...');
    const { data: deletedWeather, error: weatherError } = await supabase
      .from('weather_data')
      .delete()
      .lt('date', cutoffDate)
      .select();

    if (weatherError) {
      console.error('Error deleting old weather data:', weatherError);
    } else {
      results.weatherData = deletedWeather?.length || 0;
      console.log(`Deleted ${results.weatherData} old weather data records`);
    }

    // Delete old weather forecast (older than today - forecasts should only be future)
    console.log('Deleting old weather forecasts...');
    const { data: deletedForecast, error: forecastError } = await supabase
      .from('weather_forecast')
      .delete()
      .lt('date', today)
      .select();

    if (forecastError) {
      console.error('Error deleting old weather forecasts:', forecastError);
    } else {
      results.weatherForecast = deletedForecast?.length || 0;
      console.log(`Deleted ${results.weatherForecast} old weather forecast records`);
    }

    // Delete old tide data (older than today - we keep 7 days forward)
    console.log('Deleting old tide data...');
    const { data: deletedTides, error: tidesError } = await supabase
      .from('tide_data')
      .delete()
      .lt('date', today)
      .select();

    if (tidesError) {
      console.error('Error deleting old tide data:', tidesError);
    } else {
      results.tideData = deletedTides?.length || 0;
      console.log(`Deleted ${results.tideData} old tide data records`);
    }

    const totalDeleted = results.surfReports + results.weatherData + results.weatherForecast + results.tideData;
    console.log(`Total records deleted: ${totalDeleted}`);
    console.log('=== CLEANUP OLD REPORTS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${totalDeleted} old records`,
        today,
        cutoffDate,
        results,
        totalDeleted,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== CLEANUP OLD REPORTS FAILED ===');
    console.error('Error in cleanup-old-reports:', error);
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
