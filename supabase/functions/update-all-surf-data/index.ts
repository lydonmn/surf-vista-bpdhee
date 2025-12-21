
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATE ALL SURF DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const results = {
      weather: null as any,
      tide: null as any,
      surf: null as any,
      report: null as any,
    };

    const errors = [];

    // Step 1: Fetch weather data
    console.log('Step 1: Fetching weather data...');
    try {
      const weatherResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-weather-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      const weatherData = await weatherResponse.json();
      results.weather = weatherData;
      
      if (!weatherData.success) {
        errors.push(`Weather: ${weatherData.error}`);
        console.error('Weather fetch failed:', weatherData);
      } else {
        console.log('Weather data fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Weather: ${errorMsg}`);
      console.error('Weather fetch error:', error);
    }

    // Step 2: Fetch tide data
    console.log('Step 2: Fetching tide data...');
    try {
      const tideResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-tide-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      const tideData = await tideResponse.json();
      results.tide = tideData;
      
      if (!tideData.success) {
        errors.push(`Tide: ${tideData.error}`);
        console.error('Tide fetch failed:', tideData);
      } else {
        console.log('Tide data fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Tide: ${errorMsg}`);
      console.error('Tide fetch error:', error);
    }

    // Step 3: Fetch surf conditions
    console.log('Step 3: Fetching surf conditions...');
    try {
      const surfResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-surf-reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      const surfData = await surfResponse.json();
      results.surf = surfData;
      
      if (!surfData.success) {
        errors.push(`Surf: ${surfData.error}`);
        console.error('Surf fetch failed:', surfData);
      } else {
        console.log('Surf conditions fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Surf: ${errorMsg}`);
      console.error('Surf fetch error:', error);
    }

    // Step 4: Generate daily report (only if we have the required data)
    if (results.weather?.success && results.surf?.success) {
      console.log('Step 4: Generating daily report...');
      try {
        const reportResponse = await fetch(`${supabaseUrl}/functions/v1/generate-daily-report`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        });

        const reportData = await reportResponse.json();
        results.report = reportData;
        
        if (!reportData.success) {
          errors.push(`Report: ${reportData.error}`);
          console.error('Report generation failed:', reportData);
        } else {
          console.log('Daily report generated successfully');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Report: ${errorMsg}`);
        console.error('Report generation error:', error);
      }
    } else {
      const msg = 'Skipping report generation - missing required data';
      errors.push(msg);
      console.log(msg);
    }

    console.log('=== UPDATE ALL SURF DATA COMPLETED ===');
    console.log('Results:', JSON.stringify(results, null, 2));
    console.log('Errors:', errors);

    const success = errors.length === 0;

    return new Response(
      JSON.stringify({
        success,
        message: success 
          ? 'All surf data updated successfully' 
          : 'Some updates failed',
        results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: success ? 200 : 207, // 207 = Multi-Status (partial success)
      }
    );
  } catch (error) {
    console.error('=== UPDATE ALL SURF DATA FAILED ===');
    console.error('Error in update-all-surf-data:', error);
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
