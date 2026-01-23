
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== 15-MINUTE BUOY DATA UPDATE STARTED ===');
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

    // Step 1: Fetch fresh surf conditions from NOAA buoy
    console.log('Step 1: Fetching fresh surf conditions from NOAA buoy...');
    const surfResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/fetch-surf-reports`,
      requestHeaders,
      45000
    );

    if (!surfResult.data.success) {
      console.log('Failed to fetch surf conditions:', surfResult.data.error);
    }

    // Step 2: Update the report with new buoy data (preserving narrative)
    console.log('Step 2: Updating report with new buoy data...');
    const updateResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/update-buoy-data-only`,
      requestHeaders,
      45000
    );

    if (updateResult.data.success) {
      console.log('=== 15-MINUTE BUOY DATA UPDATE COMPLETED ===');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Buoy data updated successfully (narrative preserved)',
          report: updateResult.data.report,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      console.log('Update failed, report will show most recent successful data from today');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Buoy data unavailable, keeping most recent successful data from today',
          error: updateResult.data.error,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('=== 15-MINUTE BUOY DATA UPDATE FAILED ===');
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
