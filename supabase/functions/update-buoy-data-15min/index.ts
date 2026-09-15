
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function invokeFunctionWithTimeout(url: string, headers: Record<string, string>, timeout: number, body?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body || JSON.stringify({}),
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

    // Fetch active locations from database
    console.log('Fetching active locations from database...');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: locationsData, error: locationsError } = await supabaseClient
      .from('locations')
      .select('id, name, display_name')
      .eq('is_active', true)
      .order('name');

    if (locationsError) {
      console.error('Error fetching locations:', locationsError);
      throw new Error(`Failed to fetch locations: ${locationsError.message}`);
    }

    if (!locationsData || locationsData.length === 0) {
      console.warn('No active locations found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active locations found in database',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${locationsData.length} active locations:`, locationsData.map(l => l.display_name).join(', '));

    const results = [];

    for (const location of locationsData) {
      console.log(`\n=== Processing ${location.display_name} ===`);
      
      try {
        // Step 1: Fetch fresh surf conditions from NOAA buoy
        console.log(`Step 1: Fetching fresh surf conditions for ${location.name}...`);
        const surfResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/fetch-surf-reports`,
          requestHeaders,
          45000,
          JSON.stringify({ location: location.id })
        );

        if (!surfResult.data.success) {
          console.log(`Failed to fetch surf conditions for ${location.name}:`, surfResult.data.error);
        }

        // Step 2: Update the report with new buoy data (preserving narrative)
        console.log(`Step 2: Updating report with new buoy data for ${location.name}...`);
        const updateResult = await invokeFunctionWithTimeout(
          `${supabaseUrl}/functions/v1/update-buoy-data-only`,
          requestHeaders,
          45000,
          JSON.stringify({ location: location.id })
        );

        if (updateResult.data.success) {
          console.log(`✅ ${location.display_name}: Buoy data updated successfully (narrative preserved)`);
          results.push({
            location: location.display_name,
            locationId: location.id,
            success: true,
            message: 'Buoy data updated successfully (narrative preserved)',
          });
        } else {
          console.log(`⚠️ ${location.display_name}: Update failed, keeping most recent successful data`);
          results.push({
            location: location.display_name,
            locationId: location.id,
            success: true,
            message: 'Buoy data unavailable, keeping most recent successful data from today',
            warning: updateResult.data.error,
          });
        }
      } catch (error) {
        console.error(`❌ ${location.display_name}: Error during update:`, error);
        results.push({
          location: location.display_name,
          locationId: location.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('=== 15-MINUTE BUOY DATA UPDATE COMPLETED ===');
    
    const allSucceeded = results.every(r => r.success);
    
    return new Response(
      JSON.stringify({
        success: allSucceeded,
        message: allSucceeded 
          ? 'Buoy data updated successfully for all locations (narratives preserved)' 
          : 'Some locations failed to update',
        results: results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
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
