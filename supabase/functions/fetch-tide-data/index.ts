
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NOAA Station ID for Folly Beach (Charleston Harbor)
const STATION_ID = '8665530'; // Charleston, Cooper River Entrance

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching tide data from NOAA...');

    // Get current date in EST
    const estDate = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York' 
    });
    const today = new Date(estDate);
    const todayStr = today.toISOString().split('T')[0].replace(/-/g, '');

    // Fetch tide predictions for today
    const tideUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=predictions&application=SurfVista&` +
      `begin_date=${todayStr}&end_date=${todayStr}&` +
      `datum=MLLW&station=${STATION_ID}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    console.log('Fetching tide predictions:', tideUrl);

    const tideResponse = await fetch(tideUrl);

    if (!tideResponse.ok) {
      throw new Error(`NOAA Tides API error: ${tideResponse.status} ${tideResponse.statusText}`);
    }

    const tideData = await tideResponse.json();

    if (!tideData.predictions || tideData.predictions.length === 0) {
      console.log('No tide predictions available');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tide predictions available for today',
          tides: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Received ${tideData.predictions.length} tide predictions`);

    // Delete old tide data for today
    const todayDate = today.toISOString().split('T')[0];
    await supabase
      .from('tide_data')
      .delete()
      .eq('date', todayDate);

    // Store tide predictions
    const tideRecords = tideData.predictions.map((prediction: any) => {
      // Parse the time (format: "2024-01-15 06:23")
      const [datePart, timePart] = prediction.t.split(' ');
      
      return {
        date: todayDate,
        time: timePart,
        type: prediction.type === 'H' ? 'High' : 'Low',
        height: parseFloat(prediction.v),
        height_unit: 'ft',
        updated_at: new Date().toISOString(),
      };
    });

    console.log(`Inserting ${tideRecords.length} tide records`);

    const { error: tideError } = await supabase
      .from('tide_data')
      .insert(tideRecords);

    if (tideError) {
      console.error('Error storing tide data:', tideError);
      throw tideError;
    }

    console.log('Tide data updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tide data updated successfully',
        tides: tideRecords.length,
        records: tideRecords,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in fetch-tide-data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
