
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_TIMEOUT = 30000; // 30 seconds per function

async function invokeFunctionWithTimeout(url: string, headers: Record<string, string>, timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log(`Invoking function: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    console.log(`Function response status: ${response.status}`);
    
    // Try to parse response body
    let responseData;
    try {
      const text = await response.text();
      console.log(`Function response body: ${text.substring(0, 500)}`);
      responseData = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response:', e);
      responseData = { success: false, error: 'Failed to parse response' };
    }
    
    return { status: response.status, data: responseData };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Function timeout after ${timeout}ms`);
      throw new Error(`Function timeout after ${timeout}ms`);
    }
    console.error('Function invocation error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATE ALL SURF DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
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

    console.log('Supabase URL:', supabaseUrl);

    const results = {
      weather: null as any,
      tide: null as any,
      surf: null as any,
      report: null as any,
    };

    const errors = [];
    const requestHeaders = {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Fetch weather data
    console.log('Step 1: Fetching weather data...');
    try {
      const weatherResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-weather-data`,
        requestHeaders,
        FUNCTION_TIMEOUT
      );

      results.weather = weatherResult.data;
      
      if (weatherResult.status !== 200 || !weatherResult.data.success) {
        const errorMsg = weatherResult.data.error || `HTTP ${weatherResult.status}`;
        errors.push(`Weather: ${errorMsg}`);
        console.error('Weather fetch failed:', errorMsg);
      } else {
        console.log('Weather data fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Weather: ${errorMsg}`);
      console.error('Weather fetch error:', error);
      results.weather = { success: false, error: errorMsg };
    }

    // Step 2: Fetch tide data
    console.log('Step 2: Fetching tide data...');
    try {
      const tideResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-tide-data`,
        requestHeaders,
        FUNCTION_TIMEOUT
      );

      results.tide = tideResult.data;
      
      if (tideResult.status !== 200 || !tideResult.data.success) {
        const errorMsg = tideResult.data.error || `HTTP ${tideResult.status}`;
        errors.push(`Tide: ${errorMsg}`);
        console.error('Tide fetch failed:', errorMsg);
      } else {
        console.log('Tide data fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Tide: ${errorMsg}`);
      console.error('Tide fetch error:', error);
      results.tide = { success: false, error: errorMsg };
    }

    // Step 3: Fetch surf conditions
    console.log('Step 3: Fetching surf conditions...');
    try {
      const surfResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-surf-reports`,
        requestHeaders,
        FUNCTION_TIMEOUT
      );

      results.surf = surfResult.data;
      
      if (surfResult.status !== 200 || !surfResult.data.success) {
        const errorMsg = surfResult.data.error || `HTTP ${surfResult.status}`;
        errors.push(`Surf: ${errorMsg}`);
        console.error('Surf fetch failed:', errorMsg);
      } else {
        console.log('Surf conditions fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Surf: ${errorMsg}`);
      console.error('Surf fetch error:', error);
      results.surf = { success: false, error: errorMsg };
    }

    // Step 4: Generate daily report (only if we have the required data)
    if (results.weather?.success && results.surf?.success) {
      console.log('Step 4: Generating daily report...');
      try {
        const reportResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/generate-daily-report`,
          requestHeaders,
          FUNCTION_TIMEOUT
        );

        results.report = reportResult.data;
        
        if (reportResult.status !== 200 || !reportResult.data.success) {
          const errorMsg = reportResult.data.error || `HTTP ${reportResult.status}`;
          errors.push(`Report: ${errorMsg}`);
          console.error('Report generation failed:', errorMsg);
        } else {
          console.log('Daily report generated successfully');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Report: ${errorMsg}`);
        console.error('Report generation error:', error);
        results.report = { success: false, error: errorMsg };
      }
    } else {
      const msg = 'Skipping report generation - missing required data (weather or surf)';
      errors.push(msg);
      console.log(msg);
      results.report = { success: false, error: msg };
    }

    console.log('=== UPDATE ALL SURF DATA COMPLETED ===');
    console.log('Results summary:', {
      weather: results.weather?.success ? 'SUCCESS' : 'FAILED',
      tide: results.tide?.success ? 'SUCCESS' : 'FAILED',
      surf: results.surf?.success ? 'SUCCESS' : 'FAILED',
      report: results.report?.success ? 'SUCCESS' : 'FAILED',
    });
    console.log('Errors:', errors);

    // Consider it a success if at least weather and surf data were fetched
    // (tide is optional, report depends on weather and surf)
    const criticalSuccess = results.weather?.success && results.surf?.success;
    const allSuccess = errors.length === 0;

    return new Response(
      JSON.stringify({
        success: criticalSuccess, // Return success if critical data was fetched
        message: allSuccess 
          ? 'All surf data updated successfully' 
          : criticalSuccess
          ? 'Critical surf data updated successfully (some optional updates failed)'
          : 'Failed to update critical surf data',
        results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Always return 200 to prevent client-side errors
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
        status: 200, // Return 200 to prevent client-side errors
      }
    );
  }
});
