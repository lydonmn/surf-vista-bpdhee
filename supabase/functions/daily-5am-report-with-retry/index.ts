
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 60; // Retry for up to 60 minutes (60 retries * 1 minute)
const RETRY_DELAY_MS = 60000; // 1 minute

async function invokeFunctionWithTimeout(url: string, headers: Record<string, string>, timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const text = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(text);
    } catch (e) {
      responseData = { success: false, error: 'Failed to parse response' };
    }
    
    return { status: response.status, data: responseData };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== DAILY 5 AM REPORT WITH RETRY STARTED ===');
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

    const requestHeaders = {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    };

    // Track successful data fetches across retries
    let hasWeatherData = false;
    let hasTideData = false;
    let hasSurfData = false;

    // Step 1: Initial fetch of all data sources (weather, tide, surf)
    console.log('Step 1: Initial fetch - Fetching weather data...');
    try {
      const weatherResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-weather-data`,
        requestHeaders,
        45000
      );
      if (weatherResult.data.success) {
        hasWeatherData = true;
        console.log('✅ Weather data fetched successfully');
      } else {
        console.log('⚠️ Weather data fetch failed:', weatherResult.data.error);
      }
    } catch (error) {
      console.log('⚠️ Weather data fetch error:', error);
    }

    console.log('Step 2: Initial fetch - Fetching tide data...');
    try {
      const tideResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-tide-data`,
        requestHeaders,
        45000
      );
      if (tideResult.data.success) {
        hasTideData = true;
        console.log('✅ Tide data fetched successfully');
      } else {
        console.log('⚠️ Tide data fetch failed:', tideResult.data.error);
      }
    } catch (error) {
      console.log('⚠️ Tide data fetch error:', error);
    }

    console.log('Step 3: Initial fetch - Fetching surf conditions...');
    try {
      const surfResult = await invokeFunctionWithTimeout(
        `${supabaseUrl}/functions/v1/fetch-surf-reports`,
        requestHeaders,
        45000
      );
      if (surfResult.data.success) {
        hasSurfData = true;
        console.log('✅ Surf data fetched successfully');
      } else {
        console.log('⚠️ Surf data fetch failed:', surfResult.data.error);
      }
    } catch (error) {
      console.log('⚠️ Surf data fetch error:', error);
    }

    // Step 2: Try to generate the first daily report with retry logic
    let reportGenerated = false;
    let lastError = '';
    let attempt = 0;

    console.log('Step 4: Attempting to generate first daily report with retry logic...');
    console.log(`Initial data status: Weather=${hasWeatherData}, Tide=${hasTideData}, Surf=${hasSurfData}`);

    while (!reportGenerated && attempt < MAX_RETRIES) {
      attempt++;
      console.log(`\n=== Report generation attempt ${attempt}/${MAX_RETRIES} ===`);
      console.log(`Current data status: Weather=${hasWeatherData}, Tide=${hasTideData}, Surf=${hasSurfData}`);

      // During retries, fetch any missing data
      if (attempt > 1) {
        // Fetch weather data if we don't have it yet
        if (!hasWeatherData) {
          console.log('Attempting to fetch weather data...');
          try {
            const weatherResult = await invokeFunctionWithTimeout(
              `${supabaseUrl}/functions/v1/fetch-weather-data`,
              requestHeaders,
              45000
            );
            if (weatherResult.data.success) {
              hasWeatherData = true;
              console.log('✅ Weather data fetched successfully on retry');
            } else {
              console.log('⚠️ Weather data still unavailable:', weatherResult.data.error);
            }
          } catch (error) {
            console.log('⚠️ Weather data fetch error:', error);
          }
        }

        // Fetch tide data if we don't have it yet
        if (!hasTideData) {
          console.log('Attempting to fetch tide data...');
          try {
            const tideResult = await invokeFunctionWithTimeout(
              `${supabaseUrl}/functions/v1/fetch-tide-data`,
              requestHeaders,
              45000
            );
            if (tideResult.data.success) {
              hasTideData = true;
              console.log('✅ Tide data fetched successfully on retry');
            } else {
              console.log('⚠️ Tide data still unavailable:', tideResult.data.error);
            }
          } catch (error) {
            console.log('⚠️ Tide data fetch error:', error);
          }
        }

        // Always try to fetch fresh surf data on retries
        console.log('Attempting to fetch fresh surf data...');
        try {
          const surfResult = await invokeFunctionWithTimeout(
            `${supabaseUrl}/functions/v1/fetch-surf-reports`,
            requestHeaders,
            45000
          );
          if (surfResult.data.success) {
            hasSurfData = true;
            console.log('✅ Surf data fetched successfully on retry');
          } else {
            console.log('⚠️ Surf data still unavailable:', surfResult.data.error);
          }
        } catch (error) {
          console.log('⚠️ Surf data fetch error:', error);
        }

        console.log(`Updated data status: Weather=${hasWeatherData}, Tide=${hasTideData}, Surf=${hasSurfData}`);
      }

      // Try to generate report with available data
      try {
        const reportResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/generate-first-daily-report`,
          requestHeaders,
          45000
        );

        if (reportResult.data.success) {
          console.log('✅ First daily report generated successfully!');
          reportGenerated = true;
          
          return new Response(
            JSON.stringify({
              success: true,
              message: `First daily report generated successfully on attempt ${attempt}`,
              attempts: attempt,
              report: reportResult.data.report,
              dataStatus: {
                weather: hasWeatherData,
                tide: hasTideData,
                surf: hasSurfData
              },
              timestamp: new Date().toISOString(),
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        } else {
          lastError = reportResult.data.error || 'Unknown error';
          console.log(`❌ Attempt ${attempt} failed: ${lastError}`);
          
          if (attempt < MAX_RETRIES) {
            console.log(`⏳ Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
            await sleep(RETRY_DELAY_MS);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Attempt ${attempt} error:`, error);
        
        if (attempt < MAX_RETRIES) {
          console.log(`⏳ Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    // If we get here, all retries failed
    console.error('=== DAILY 5 AM REPORT FAILED AFTER ALL RETRIES ===');
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to generate report after ${MAX_RETRIES} attempts`,
        lastError,
        attempts: attempt,
        dataStatus: {
          weather: hasWeatherData,
          tide: hasTideData,
          surf: hasSurfData
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== DAILY 5 AM REPORT FAILED ===');
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
