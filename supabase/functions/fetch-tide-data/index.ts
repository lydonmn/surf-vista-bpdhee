
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NOAA Station ID for Folly Beach (Charleston Harbor)
const STATION_ID = '8665530'; // Charleston, Cooper River Entrance
const FETCH_TIMEOUT = 15000; // 15 seconds

// Helper function to get EST date
function getESTDate(daysOffset: number = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + daysOffset);
  
  // Get EST time by using toLocaleString with America/New_York timezone
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the EST date string (format: MM/DD/YYYY)
  const [month, day, year] = estDateString.split('/');
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

// Helper function to convert ISO timestamp to EST date string
function getESTDateFromISO(isoString: string): string {
  const date = new Date(isoString);
  const estDateString = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the EST date string (format: MM/DD/YYYY)
  const [month, day, year] = estDateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH TIDE DATA STARTED ===');
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
          status: 500,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching tide data from NOAA for Folly Beach, SC...');
    console.log('Station ID:', STATION_ID, '(Charleston Harbor)');

    // Get current date in EST
    const today = getESTDate(0);
    const endDate = getESTDate(6); // 7 days from today
    
    console.log('Fetching tide data from:', today, 'to:', endDate);
    console.log('Current UTC time:', new Date().toISOString());

    // Format dates for NOAA API (YYYYMMDD)
    const todayStr = today.replace(/-/g, '');
    const endDateStr = endDate.replace(/-/g, '');

    // Fetch tide predictions for the next 7 days
    const tideUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=predictions&application=SurfVista&` +
      `begin_date=${todayStr}&end_date=${endDateStr}&` +
      `datum=MLLW&station=${STATION_ID}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    console.log('Fetching tide predictions:', tideUrl);

    let tideResponse;
    try {
      tideResponse = await fetchWithTimeout(tideUrl);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown fetch error';
      console.error('Failed to fetch tide data:', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch tide data: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!tideResponse.ok) {
      const errorText = await tideResponse.text();
      console.error('NOAA Tides API error:', tideResponse.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `NOAA Tides API error: ${tideResponse.status}`,
          details: errorText.substring(0, 200),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const tideData = await tideResponse.json();
    console.log('Tide data received, predictions count:', tideData.predictions?.length || 0);

    if (!tideData.predictions || tideData.predictions.length === 0) {
      console.log('No tide predictions available for the date range');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tide predictions available for the date range',
          tides: 0,
          count: 0,
          dateRange: { start: today, end: endDate },
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Received ${tideData.predictions.length} tide predictions`);

    // Delete ALL old tide data to prevent duplicates
    const { error: deleteError } = await supabase
      .from('tide_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      console.error('Error deleting old tide data:', deleteError);
    } else {
      console.log('Deleted all old tide data');
    }

    // Store tide predictions - group by date
    const tideRecords = tideData.predictions.map((prediction: any) => {
      // Parse the time (format: "2024-01-15 06:23")
      const [datePart, timePart] = prediction.t.split(' ');
      
      // Convert the date to EST format
      const date = getESTDateFromISO(prediction.t);
      
      return {
        date: date,
        time: timePart,
        type: prediction.type === 'H' ? 'High' : 'Low',
        height: parseFloat(prediction.v),
        height_unit: 'ft',
        updated_at: new Date().toISOString(),
      };
    });

    // Group by date for logging
    const tidesByDate = tideRecords.reduce((acc: any, record: any) => {
      if (!acc[record.date]) {
        acc[record.date] = [];
      }
      acc[record.date].push(record);
      return acc;
    }, {});

    console.log('Tide records by date:');
    Object.keys(tidesByDate).forEach(date => {
      console.log(`  ${date}: ${tidesByDate[date].length} tides`);
    });

    console.log(`Inserting ${tideRecords.length} tide records`);

    const { data: insertData, error: tideError } = await supabase
      .from('tide_data')
      .insert(tideRecords)
      .select();

    if (tideError) {
      console.error('Error storing tide data:', tideError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store tide data in database',
          details: tideError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log(`Tide data stored successfully: ${insertData?.length || 0} records`);
    console.log('=== FETCH TIDE DATA COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tide data updated successfully for Folly Beach, SC (7-day forecast)',
        location: 'Folly Beach, SC (Charleston Harbor)',
        tides: tideRecords.length,
        count: tideRecords.length,
        records: tideRecords,
        dateRange: { start: today, end: endDate },
        tidesByDate: Object.keys(tidesByDate).map(date => ({
          date,
          count: tidesByDate[date].length
        })),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH TIDE DATA FAILED ===');
    console.error('Error in fetch-tide-data:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    
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
