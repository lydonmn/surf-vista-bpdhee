
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

    // Step 1: Fetch all data sources (weather, tide, surf)
    console.log('Step 1: Fetching weather data...');
    const weatherResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-weather-data`,
      requestHeaders,
      45000
    );

    console.log('Step 2: Fetching tide data...');
    const tideResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-tide-data`,
      requestHeaders,
      45000
    );

    console.log('Step 3: Fetching surf conditions...');
    const surfResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-surf-reports`,
      requestHeaders,
      45000
    );

    // Step 2: Try to generate the first daily report with retry logic
    let reportGenerated = false;
    let lastError = '';
    let attempt = 0;

    console.log('Step 4: Attempting to generate first daily report with retry logic...');

    while (!reportGenerated && attempt < MAX_RETRIES) {
      attempt++;
      console.log(`Report generation attempt ${attempt}/${MAX_RETRIES}...`);

      try {
        // Fetch fresh surf data before each attempt
        if (attempt > 1) {
          console.log('Fetching fresh surf data before retry...');
          await invokeFunctionWithTimeout(
            `${supabaseUrl}/functions/v1/fetch-surf-reports`,
            requestHeaders,
            45000
          );
        }

        const reportResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/generate-first-daily-report`,
          requestHeaders,
          45000
        );

        if (reportResult.data.success) {
          console.log('First daily report generated successfully!');
          reportGenerated = true;
          
          return new Response(
            JSON.stringify({
              success: true,
              message: `First daily report generated successfully on attempt ${attempt}`,
              attempts: attempt,
              report: reportResult.data.report,
              timestamp: new Date().toISOString(),
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        } else {
          lastError = reportResult.data.error || 'Unknown error';
          console.log(`Attempt ${attempt} failed: ${lastError}`);
          
          if (attempt < MAX_RETRIES) {
            console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
            await sleep(RETRY_DELAY_MS);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Attempt ${attempt} error:`, error);
        
        if (attempt < MAX_RETRIES) {
          console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
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
