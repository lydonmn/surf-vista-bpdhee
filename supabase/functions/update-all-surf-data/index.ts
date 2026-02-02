
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_TIMEOUT = 45000; // Increased to 45 seconds per function

async function invokeFunctionWithTimeout(url: string, headers: Record<string, string>, timeout: number, retries: number = 2, body?: string) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`Invoking function: ${url} (attempt ${attempt}/${retries})`);
      if (body) {
        console.log(`Request body: ${body}`);
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      console.log(`Function response status: ${response.status}`);
      
      let responseData;
      try {
        const text = await response.text();
        console.log(`Function response: ${text.substring(0, 200)}`);
        responseData = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', e);
        responseData = { success: false, error: 'Failed to parse response' };
      }
      
      return { status: response.status, data: responseData };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Function timeout after ${timeout}ms (attempt ${attempt})`);
      } else {
        console.error(`Function invocation error (attempt ${attempt}):`, error);
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATE ALL SURF DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    // Parse request body to get location parameter
    let location = 'folly-beach'; // Default location
    try {
      const body = await req.json();
      if (body.location) {
        location = body.location;
        console.log('Location parameter received:', location);
      }
    } catch (e) {
      console.log('No location parameter in request body, using default: folly-beach');
    }

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

    const results = {
      weather: null as any,
      tide: null as any,
      surf: null as any,
      surfForecast: null as any,
      report: null as any,
    };

    const errors = [];
    
    const requestHeaders = {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    };

    console.log('Step 1: Fetching weather data...');
    try {
      const weatherResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-weather-data`,
        {
          ...requestHeaders,
          'Content-Type': 'application/json',
        },
        FUNCTION_TIMEOUT,
        2,
        JSON.stringify({ location })
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

    console.log('Step 2: Fetching tide data...');
    try {
      const tideResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-tide-data`,
        {
          ...requestHeaders,
          'Content-Type': 'application/json',
        },
        FUNCTION_TIMEOUT,
        2,
        JSON.stringify({ location })
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

    console.log('Step 3: Fetching surf conditions...');
    try {
      const surfResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-surf-reports`,
        {
          ...requestHeaders,
          'Content-Type': 'application/json',
        },
        FUNCTION_TIMEOUT,
        2,
        JSON.stringify({ location })
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

    console.log('Step 4: Fetching 7-day surf forecast...');
    try {
      const surfForecastResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-surf-forecast`,
        {
          ...requestHeaders,
          'Content-Type': 'application/json',
        },
        FUNCTION_TIMEOUT,
        2,
        JSON.stringify({ location })
      );

      results.surfForecast = surfForecastResult.data;
      
      if (surfForecastResult.status !== 200 || !surfForecastResult.data.success) {
        const errorMsg = surfForecastResult.data.error || `HTTP ${surfForecastResult.status}`;
        errors.push(`Surf Forecast: ${errorMsg}`);
        console.error('Surf forecast fetch failed:', errorMsg);
      } else {
        console.log('7-day surf forecast fetched successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Surf Forecast: ${errorMsg}`);
      console.error('Surf forecast fetch error:', error);
      results.surfForecast = { success: false, error: errorMsg };
    }

    if (results.weather?.success && results.surf?.success) {
      console.log('Step 5: Generating daily report...');
      try {
        const reportResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/generate-daily-report`,
          {
            ...requestHeaders,
            'Content-Type': 'application/json',
          },
          FUNCTION_TIMEOUT,
          2,
          JSON.stringify({ location })
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
      const msg = 'Skipping report generation - missing required data';
      console.log(msg);
      results.report = { success: false, error: msg };
    }

    console.log('=== UPDATE ALL SURF DATA COMPLETED ===');

    const criticalSuccess = results.weather?.success && results.surf?.success && results.surfForecast?.success;

    const locationName = location === 'pawleys-island' ? 'Pawleys Island, SC' : 'Folly Beach, SC';

    return new Response(
      JSON.stringify({
        success: criticalSuccess,
        message: criticalSuccess 
          ? `Surf data and 7-day forecast updated successfully for ${locationName}` 
          : 'Failed to update critical surf data',
        location: locationName,
        locationId: location,
        results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== UPDATE ALL SURF DATA FAILED ===');
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
