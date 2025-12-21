
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * This function is designed to be called by a cron job daily at 6:00 AM EST
 * It orchestrates the fetching of all weather, tide, and surf data
 * and generates a comprehensive daily report
 * 
 * AUTOMATIC DATE HANDLING:
 * - All data fetching functions automatically use the current date in EST timezone
 * - No manual date management required
 * - Dates are calculated dynamically using toLocaleString with America/New_York timezone
 */

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
    console.log('=== DAILY UPDATE CRON STARTED ===');
    console.log('Timestamp (UTC):', new Date().toISOString());
    
    // Log current EST time for verification
    const estTime = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'long'
    });
    console.log('Current EST time:', estTime);
    console.log('Location: Folly Beach, SC');

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

    const requestHeaders = {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };

    // Use the unified update function for simplicity and reliability
    console.log('Calling unified update function...');
    const updateResult = await invokeFunctionWithTimeout(
      `${supabaseUrl}/functions/v1/update-all-surf-data`,
      requestHeaders,
      120000 // 2 minutes total timeout for all operations
    );

    console.log('Update result:', updateResult.data);

    if (updateResult.status !== 200 || !updateResult.data.success) {
      const errorMsg = updateResult.data.error || `HTTP ${updateResult.status}`;
      console.error('Update failed:', errorMsg);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          details: updateResult.data,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('=== DAILY UPDATE CRON COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily update completed successfully for Folly Beach, SC',
        location: 'Folly Beach, SC',
        estTime,
        results: updateResult.data,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== DAILY UPDATE CRON FAILED ===');
    console.error('Error in daily-update-cron:', error);
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
