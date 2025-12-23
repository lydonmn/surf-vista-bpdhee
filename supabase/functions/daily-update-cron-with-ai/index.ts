
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_TIMEOUT = 45000; // 45 seconds per function

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
    
    let responseData;
    try {
      const text = await response.text();
      console.log(`Function response: ${text.substring(0, 500)}`);
      responseData = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response:', e);
      responseData = { success: false, error: 'Failed to parse response' };
    }
    
    return { status: response.status, data: responseData };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Function timeout after ${timeout}ms`);
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== DAILY UPDATE CRON WITH AI STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const results = {
      surf: null as any,
      tide: null as any,
      trends: null as any,
      weather: null as any,
      report: null as any,
    };

    const errors = [];
    const requestHeaders = {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Fetch surf conditions
    console.log('Step 1: Fetching surf conditions...');
    try {
      const surfResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-surf-reports`,
        requestHeaders,
        FUNCTION_TIMEOUT
      );

      results.surf = surfResult.data;
      
      if (surfResult.status !== 200 || !surfResult.data.success) {
        errors.push(`Surf: ${surfResult.data.error || 'Failed'}`);
      } else {
        console.log('✅ Surf conditions fetched');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Surf: ${errorMsg}`);
      results.surf = { success: false, error: errorMsg };
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
        errors.push(`Tide: ${tideResult.data.error || 'Failed'}`);
      } else {
        console.log('✅ Tide data fetched');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Tide: ${errorMsg}`);
      results.tide = { success: false, error: errorMsg };
    }

    // Step 3: Analyze surf trends (NEW - AI predictions)
    console.log('Step 3: Analyzing surf trends with AI...');
    try {
      const trendsResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/analyze-surf-trends`,
        requestHeaders,
        FUNCTION_TIMEOUT
      );

      results.trends = trendsResult.data;
      
      if (trendsResult.status !== 200 || !trendsResult.data.success) {
        errors.push(`Trends: ${trendsResult.data.error || 'Failed'}`);
      } else {
        console.log('✅ Surf trends analyzed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Trends: ${errorMsg}`);
      results.trends = { success: false, error: errorMsg };
    }

    // Step 4: Fetch weather data with AI predictions
    console.log('Step 4: Fetching weather data with AI predictions...');
    try {
      const weatherResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-weather-data-with-predictions`,
        requestHeaders,
        FUNCTION_TIMEOUT
      );

      results.weather = weatherResult.data;
      
      if (weatherResult.status !== 200 || !weatherResult.data.success) {
        errors.push(`Weather: ${weatherResult.data.error || 'Failed'}`);
      } else {
        console.log('✅ Weather data with predictions fetched');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Weather: ${errorMsg}`);
      results.weather = { success: false, error: errorMsg };
    }

    // Step 5: Generate daily report
    if (results.weather?.success && results.surf?.success) {
      console.log('Step 5: Generating daily report...');
      try {
        const reportResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/generate-daily-report`,
          requestHeaders,
          FUNCTION_TIMEOUT
        );

        results.report = reportResult.data;
        
        if (reportResult.status !== 200 || !reportResult.data.success) {
          errors.push(`Report: ${reportResult.data.error || 'Failed'}`);
        } else {
          console.log('✅ Daily report generated');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Report: ${errorMsg}`);
        results.report = { success: false, error: errorMsg };
      }
    } else {
      const msg = 'Skipping report - missing required data';
      errors.push(msg);
      results.report = { success: false, error: msg };
    }

    console.log('=== DAILY UPDATE CRON WITH AI COMPLETED ===');
    console.log('Results:', {
      surf: results.surf?.success ? 'SUCCESS' : 'FAILED',
      tide: results.tide?.success ? 'SUCCESS' : 'FAILED',
      trends: results.trends?.success ? 'SUCCESS' : 'FAILED',
      weather: results.weather?.success ? 'SUCCESS' : 'FAILED',
      report: results.report?.success ? 'SUCCESS' : 'FAILED',
    });

    const criticalSuccess = results.weather?.success && results.surf?.success;

    return new Response(
      JSON.stringify({
        success: criticalSuccess,
        message: criticalSuccess 
          ? 'Daily update with AI predictions completed successfully'
          : 'Daily update failed',
        location: 'Folly Beach, SC',
        results,
        errors: errors.length > 0 ? errors : undefined,
        ai_enabled: results.trends?.success || false,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== DAILY UPDATE CRON WITH AI FAILED ===');
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
