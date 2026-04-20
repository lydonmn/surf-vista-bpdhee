
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_TIMEOUT = 45000; // 45 seconds per function

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

async function processLocation(
  locationId: string,
  displayName: string,
  supabaseUrl: string,
  requestHeaders: Record<string, string>
): Promise<{ location: string; displayName: string; success: boolean; errors: string[]; results: Record<string, any> }> {
  console.log(`\n--- Processing location: ${locationId} (${displayName}) ---`);

  const results: Record<string, any> = {
    weather: null,
    tide: null,
    surf: null,
    surfForecast: null,
    report: null,
  };
  const errors: string[] = [];

  // Step 1: Weather
  console.log(`[${locationId}] Step 1: Fetching weather data...`);
  try {
    const weatherResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-weather-data`,
      { ...requestHeaders, 'Content-Type': 'application/json' },
      FUNCTION_TIMEOUT,
      2,
      JSON.stringify({ location: locationId })
    );
    results.weather = weatherResult.data;
    if (weatherResult.status !== 200 || !weatherResult.data.success) {
      const errorMsg = weatherResult.data.error || `HTTP ${weatherResult.status}`;
      errors.push(`Weather: ${errorMsg}`);
      console.error(`[${locationId}] Weather fetch failed:`, errorMsg);
    } else {
      console.log(`[${locationId}] Weather data fetched successfully`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Weather: ${errorMsg}`);
    console.error(`[${locationId}] Weather fetch error:`, error);
    results.weather = { success: false, error: errorMsg };
  }

  // Step 2: Tide
  console.log(`[${locationId}] Step 2: Fetching tide data...`);
  try {
    const tideResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-tide-data`,
      { ...requestHeaders, 'Content-Type': 'application/json' },
      FUNCTION_TIMEOUT,
      2,
      JSON.stringify({ location: locationId })
    );
    results.tide = tideResult.data;
    if (tideResult.status !== 200 || !tideResult.data.success) {
      const errorMsg = tideResult.data.error || `HTTP ${tideResult.status}`;
      errors.push(`Tide: ${errorMsg}`);
      console.error(`[${locationId}] Tide fetch failed:`, errorMsg);
    } else {
      console.log(`[${locationId}] Tide data fetched successfully`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Tide: ${errorMsg}`);
    console.error(`[${locationId}] Tide fetch error:`, error);
    results.tide = { success: false, error: errorMsg };
  }

  // Step 3: Surf conditions
  console.log(`[${locationId}] Step 3: Fetching surf conditions...`);
  try {
    const surfResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-surf-reports`,
      { ...requestHeaders, 'Content-Type': 'application/json' },
      FUNCTION_TIMEOUT,
      2,
      JSON.stringify({ location: locationId })
    );
    results.surf = surfResult.data;
    if (surfResult.status !== 200 || !surfResult.data.success) {
      const errorMsg = surfResult.data.error || `HTTP ${surfResult.status}`;
      errors.push(`Surf: ${errorMsg}`);
      console.error(`[${locationId}] Surf fetch failed:`, errorMsg);
    } else {
      console.log(`[${locationId}] Surf conditions fetched successfully`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Surf: ${errorMsg}`);
    console.error(`[${locationId}] Surf fetch error:`, error);
    results.surf = { success: false, error: errorMsg };
  }

  // Step 4: 7-day surf forecast
  console.log(`[${locationId}] Step 4: Fetching 7-day surf forecast...`);
  try {
    const surfForecastResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-surf-forecast`,
      { ...requestHeaders, 'Content-Type': 'application/json' },
      FUNCTION_TIMEOUT,
      2,
      JSON.stringify({ location: locationId })
    );
    results.surfForecast = surfForecastResult.data;
    if (surfForecastResult.status !== 200 || !surfForecastResult.data.success) {
      const errorMsg = surfForecastResult.data.error || `HTTP ${surfForecastResult.status}`;
      errors.push(`Surf Forecast: ${errorMsg}`);
      console.error(`[${locationId}] Surf forecast fetch failed:`, errorMsg);
    } else {
      console.log(`[${locationId}] 7-day surf forecast fetched successfully`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Surf Forecast: ${errorMsg}`);
    console.error(`[${locationId}] Surf forecast fetch error:`, error);
    results.surfForecast = { success: false, error: errorMsg };
  }

  // Step 5: Daily report (only if weather + surf succeeded)
  if (results.weather?.success && results.surf?.success) {
    console.log(`[${locationId}] Step 5: Generating daily report...`);
    try {
      const reportResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/generate-daily-report`,
        { ...requestHeaders, 'Content-Type': 'application/json' },
        FUNCTION_TIMEOUT,
        2,
        JSON.stringify({ location: locationId })
      );
      results.report = reportResult.data;
      if (reportResult.status !== 200 || !reportResult.data.success) {
        const errorMsg = reportResult.data.error || `HTTP ${reportResult.status}`;
        errors.push(`Report: ${errorMsg}`);
        console.error(`[${locationId}] Report generation failed:`, errorMsg);
      } else {
        console.log(`[${locationId}] Daily report generated successfully`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Report: ${errorMsg}`);
      console.error(`[${locationId}] Report generation error:`, error);
      results.report = { success: false, error: errorMsg };
    }
  } else {
    const msg = 'Skipping report generation - missing required data';
    console.log(`[${locationId}] ${msg}`);
    results.report = { success: false, error: msg };
  }

  const success = results.weather?.success && results.surf?.success && results.surfForecast?.success;
  console.log(`--- Finished location: ${locationId} | success=${success} errors=${errors.length} ---\n`);

  return { location: locationId, displayName, success, errors, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATE ALL SURF DATA STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    // Parse request body for optional single-location override
    let explicitLocation: string | null = null;
    try {
      const body = await req.json();
      if (body?.location) {
        explicitLocation = body.location;
        console.log('Explicit location parameter received:', explicitLocation);
      }
    } catch (_e) {
      console.log('No request body / no location param — will process all active locations');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      const error = 'Missing Supabase environment variables';
      console.error(error);
      return new Response(
        JSON.stringify({ success: false, error, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const requestHeaders = {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    };

    // Determine which locations to process
    let locationsToProcess: Array<{ id: string; display_name: string }> = [];

    if (explicitLocation) {
      // Single-location path: look up display_name from DB, fall back gracefully
      console.log(`Single-location mode: ${explicitLocation}`);
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/locations?id=eq.${encodeURIComponent(explicitLocation)}&select=id,display_name&limit=1`,
          { headers: requestHeaders }
        );
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0) {
            locationsToProcess = [{ id: rows[0].id, display_name: rows[0].display_name }];
          }
        }
      } catch (e) {
        console.warn('Could not look up location from DB, using id as display name:', e);
      }
      // Fallback if DB lookup failed
      if (locationsToProcess.length === 0) {
        locationsToProcess = [{ id: explicitLocation, display_name: explicitLocation }];
      }
    } else {
      // All-locations path: query locations table for active locations
      console.log('All-locations mode: querying active locations...');
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/locations?is_active=eq.true&select=id,display_name&order=id.asc`,
          { headers: requestHeaders }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Locations query failed (${res.status}): ${text}`);
        }
        const rows = await res.json();
        locationsToProcess = rows.map((r: any) => ({ id: r.id, display_name: r.display_name }));
        console.log(`Found ${locationsToProcess.length} active location(s):`, locationsToProcess.map(l => l.id));
      } catch (e) {
        console.error('Failed to fetch active locations:', e);
        return new Response(
          JSON.stringify({
            success: false,
            error: e instanceof Error ? e.message : 'Failed to fetch active locations',
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      if (locationsToProcess.length === 0) {
        console.warn('No active locations found in the locations table');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No active locations found',
            results: [],
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Process each location sequentially to avoid hammering downstream APIs
    const locationResults = [];
    for (const loc of locationsToProcess) {
      const result = await processLocation(loc.id, loc.display_name, supabaseUrl, requestHeaders);
      locationResults.push(result);
    }

    const allSucceeded = locationResults.every(r => r.success);
    const anySucceeded = locationResults.some(r => r.success);

    console.log('=== UPDATE ALL SURF DATA COMPLETED ===');
    console.log(`Processed ${locationResults.length} location(s). All succeeded: ${allSucceeded}`);

    return new Response(
      JSON.stringify({
        success: allSucceeded,
        partial_success: !allSucceeded && anySucceeded,
        message: allSucceeded
          ? `Surf data updated successfully for all ${locationResults.length} location(s)`
          : anySucceeded
            ? `Surf data updated for some locations (${locationResults.filter(r => r.success).length}/${locationResults.length})`
            : 'Failed to update surf data for all locations',
        results: locationResults.map(r => ({
          location: r.location,
          displayName: r.displayName,
          success: r.success,
          errors: r.errors.length > 0 ? r.errors : undefined,
        })),
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
