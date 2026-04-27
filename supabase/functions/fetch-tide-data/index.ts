
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT = 30000; // Increased to 30 seconds

function getESTDate(daysOffset: number = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + daysOffset);
  
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = estDateString.split('/');
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return estDate;
}

function getESTDateFromISO(isoString: string): string {
  const date = new Date(isoString);
  const estDateString = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = estDateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT, retries: number = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`Fetching ${url} (attempt ${attempt}/${retries})`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Request timeout after ${timeout}ms (attempt ${attempt})`);
      } else {
        console.error(`Fetch error (attempt ${attempt}):`, error);
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
          status: 200,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body to get location parameter
    let locationId = 'folly-beach'; // Default location
    try {
      const body = await req.json();
      if (body.location) {
        locationId = body.location;
        console.log('Location parameter received:', locationId);
      }
    } catch (e) {
      console.log('No location parameter in request body, using default: folly-beach');
    }

    // 🔥 DYNAMIC: Fetch location configuration from database
    console.log('Fetching location configuration from database for:', locationId);
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (locationError || !locationData) {
      console.error('Location not found in database:', locationId, locationError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Location not found: ${locationId}`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fallback tide station IDs for known locations in case the DB row is missing the value
    const FALLBACK_TIDE_STATIONS: Record<string, string> = {
      'virginia-beach-va': '8638610',       // Sewells Point, Norfolk VA
      'virginia-beach': '8638610',
      'virginia-beach-pier-va': '8638610',  // Virginia Beach Pier — Sewells Point, Norfolk VA
      'virginia-beach-pier': '8638610',
      'folly-beach': '8665530',             // Charleston, SC
      'pawleys-island': '8661070',          // Springmaid Pier, SC
      'holden-beach-nc': '8658163',         // Wrightsville Beach, NC
      'marshfield-ma': '8443970',           // Boston, MA
      'cisco-beach-nantucket': '8449130',   // Nantucket, MA
      'jupiter-florida': '8722670',         // Lake Worth Pier, FL
      'jupiter-inlet': '8722670',
      'jupiter': '8722670',
    };

    // Check if location ID contains "virginia" as a broader fallback
    const isVirginiaBeach = locationId.toLowerCase().includes('virginia');
    const tideStationId = locationData.tide_station_id
      || FALLBACK_TIDE_STATIONS[locationId]
      || (isVirginiaBeach ? '8638610' : undefined);

    console.log('[tide] Virginia Beach station ID:', tideStationId);
    console.log('Using location from database:', {
      id: locationData.id,
      name: locationData.display_name,
      tideStationId: locationData.tide_station_id,
      resolvedTideStationId: tideStationId,
      usingFallback: !locationData.tide_station_id,
      fallbackKey: FALLBACK_TIDE_STATIONS[locationId] ? locationId : (isVirginiaBeach ? 'virginia-beach-broad-match' : 'none'),
    });

    if (!tideStationId) {
      console.error(`No tide station ID found for location: ${locationId}. Set tide_station_id in the locations table.`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `No tide station configured for location: ${locationId}. Please set tide_station_id in the locations table.`,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Fetching tide data from NOAA for ${locationData.display_name} (station: ${tideStationId})...`);

    const today = getESTDate(0);
    const endDate = getESTDate(6);
    
    console.log('Fetching tide data from:', today, 'to:', endDate);

    const todayStr = today.replace(/-/g, '');
    const endDateStr = endDate.replace(/-/g, '');

    const tideUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=predictions&application=SurfVista&` +
      `begin_date=${todayStr}&end_date=${endDateStr}&` +
      `datum=MLLW&station=${tideStationId}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
    
    console.log('NOAA tide URL:', tideUrl);

    console.log('Fetching tide predictions');

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
          status: 200,
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
          status: 200,
        }
      );
    }

    const tideData = await tideResponse.json();
    console.log('Tide data received, predictions count:', tideData.predictions?.length || 0);

    if (!tideData.predictions || tideData.predictions.length === 0) {
      console.log('No tide predictions available');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tide predictions available for the date range',
          tides: 0,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const { error: deleteError } = await supabase
      .from('tide_data')
      .delete()
      .eq('location', locationId);

    if (deleteError) {
      console.error('Error deleting old tide data:', deleteError);
    }

    const tideRecords = tideData.predictions.map((prediction: any) => {
      const [datePart, timePart] = prediction.t.split(' ');
      const date = getESTDateFromISO(prediction.t);
      
      return {
        date: date,
        location: locationId,
        time: timePart,
        type: prediction.type === 'H' ? 'High' : 'Low',
        height: parseFloat(prediction.v),
        height_unit: 'ft',
        updated_at: new Date().toISOString(),
      };
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
          status: 200,
        }
      );
    }

    console.log('=== FETCH TIDE DATA COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tide data updated successfully for ${locationData.display_name}`,
        location: locationData.display_name,
        locationId: locationId,
        tides: tideRecords.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FETCH TIDE DATA FAILED ===');
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
