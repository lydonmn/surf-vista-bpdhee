
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getESTDate(): string {
  const now = new Date();
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

function parseNumericValue(value: string | null | undefined, defaultValue: number = 0): number {
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  const match = value.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

function calculateSurfRating(surfData: any, weatherData: any): number {
  try {
    const heightStr = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;
    
    if (heightStr === 'N/A') {
      return 0;
    }
    
    const surfHeight = parseNumericValue(heightStr, 0);
    const windSpeed = parseNumericValue(surfData.wind_speed, 0);
    const windDir = (surfData.wind_direction || '').toLowerCase();
    
    let conditions = 'clean';
    
    if (windDir.includes('w') || windDir.includes('n')) {
      if (windSpeed < 10) {
        conditions = 'clean';
      } else if (windSpeed < 15) {
        conditions = 'clean';
      } else if (windSpeed < 20) {
        conditions = 'moderate';
      } else {
        conditions = 'poor';
      }
    } else if (windDir.includes('e') || windDir.includes('s')) {
      if (windSpeed < 8) {
        conditions = 'clean';
      } else if (windSpeed < 12) {
        conditions = 'moderately poor';
      } else if (windSpeed < 18) {
        conditions = 'poor';
      } else {
        conditions = 'very poor';
      }
    }

    const period = parseNumericValue(surfData.wave_period, 0);
    
    if (period < 6 && conditions === 'clean') {
      conditions = 'moderate';
    } else if (period < 6 && conditions === 'moderate') {
      conditions = 'poor';
    }

    let rating = 0;

    if (surfHeight <= 1.5) {
      rating = conditions === 'clean' ? 2 : 1;
    } else if (surfHeight <= 3) {
      rating = conditions === 'clean' ? 4 : Math.max(2, 4 - Math.floor(windSpeed / 10));
    } else if (surfHeight > 3 && surfHeight < 4.5) {
      rating = conditions === 'clean' ? 6 : 4;
    } else if (surfHeight >= 4.5 && surfHeight <= 6) {
      if (conditions === 'clean') {
        rating = 8;
      } else if (conditions === 'moderate') {
        rating = 7;
      } else if (conditions === 'moderately poor') {
        rating = 6;
      } else if (conditions === 'poor') {
        rating = 5;
      } else if (conditions === 'very poor') {
        rating = 4;
      } else {
        rating = 6;
      }
    } else if (surfHeight >= 7) {
      if (conditions === 'clean') {
        rating = 10;
      } else if (conditions === 'moderate') {
        rating = 9;
      } else if (conditions === 'poor') {
        rating = 8;
      } else if (conditions === 'very poor') {
        rating = 7;
      } else {
        rating = 8;
      }
    }

    rating = Math.max(1, Math.min(10, rating));
    
    return rating;
  } catch (error) {
    console.error('Error calculating surf rating:', error);
    return 5;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATE BUOY DATA ONLY STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
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

    const locationName = locationId === 'pawleys-island' ? 'Pawleys Island, SC' : 'Folly Beach, SC';
    console.log('Updating buoy data for:', locationName);
    
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

    const today = getESTDate();
    console.log('Current EST date:', today);

    // Fetch the latest surf conditions for today and this location
    const surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .eq('location', locationId)
      .maybeSingle();

    if (surfResult.error) {
      console.error('Error fetching surf conditions:', surfResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch surf conditions',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const newSurfData = surfResult.data;

    // Check if we have valid wave data from the latest fetch
    const hasValidWaveData = newSurfData && (newSurfData.wave_height !== 'N/A' || newSurfData.surf_height !== 'N/A');

    if (!hasValidWaveData) {
      console.log('⚠️ No valid wave data available from latest buoy fetch');
      console.log('Looking for most recent successful buoy data to use as fallback...');
      
      // Get the existing report for today and this location
      const existingReportResult = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .eq('location', locationId)
        .maybeSingle();

      if (existingReportResult.data) {
        const existingReport = existingReportResult.data;
        const hasExistingValidData = existingReport.wave_height !== 'N/A' && existingReport.wave_height !== null;
        
        if (hasExistingValidData) {
          console.log('✅ Keeping existing report with valid buoy data from earlier today');
          console.log('Existing data:', {
            wave_height: existingReport.wave_height,
            wind_speed: existingReport.wind_speed,
            water_temp: existingReport.water_temp,
            updated_at: existingReport.updated_at
          });
          
          // Update only the available data (wind and water temp) while keeping wave data from earlier
          const partialUpdate: any = {
            updated_at: new Date().toISOString(),
          };
          
          // Update wind data if available
          if (newSurfData && newSurfData.wind_speed && newSurfData.wind_speed !== 'N/A') {
            partialUpdate.wind_speed = newSurfData.wind_speed;
          }
          if (newSurfData && newSurfData.wind_direction && newSurfData.wind_direction !== 'N/A') {
            partialUpdate.wind_direction = newSurfData.wind_direction;
          }
          
          // Update water temp if available
          if (newSurfData && newSurfData.water_temp && newSurfData.water_temp !== 'N/A') {
            partialUpdate.water_temp = newSurfData.water_temp;
          }
          
          // Only update if we have new data to add
          if (Object.keys(partialUpdate).length > 1) {
            console.log('Updating wind/water temp while keeping wave data from earlier:', partialUpdate);
            await supabase
              .from('surf_reports')
              .update(partialUpdate)
              .eq('date', today);
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Wave sensors offline - using last successful wave data, updated wind/water temp',
              report: existingReport,
              fallbackMode: true,
              timestamp: new Date().toISOString(),
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        } else {
          console.log('⚠️ Existing report also has no valid wave data, looking for most recent historical data...');
          
          // Look for the most recent report with valid wave data (from any previous day) for this location
          const historicalReportResult = await supabase
            .from('surf_reports')
            .select('*')
            .eq('location', locationId)
            .neq('wave_height', 'N/A')
            .not('wave_height', 'is', null)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (historicalReportResult.data) {
            const historicalReport = historicalReportResult.data;
            console.log('✅ Found historical data from:', historicalReport.date);
            console.log('Historical wave data:', {
              wave_height: historicalReport.wave_height,
              wave_period: historicalReport.wave_period,
              swell_direction: historicalReport.swell_direction,
              date: historicalReport.date
            });
            
            // Update today's report with historical wave data + current wind/water temp
            const fallbackUpdate: any = {
              wave_height: historicalReport.wave_height,
              wave_period: historicalReport.wave_period || 'N/A',
              swell_direction: historicalReport.swell_direction || 'N/A',
              updated_at: new Date().toISOString(),
            };
            
            // Add current wind and water temp if available
            if (newSurfData && newSurfData.wind_speed && newSurfData.wind_speed !== 'N/A') {
              fallbackUpdate.wind_speed = newSurfData.wind_speed;
            } else {
              fallbackUpdate.wind_speed = historicalReport.wind_speed || 'N/A';
            }
            
            if (newSurfData && newSurfData.wind_direction && newSurfData.wind_direction !== 'N/A') {
              fallbackUpdate.wind_direction = newSurfData.wind_direction;
            } else {
              fallbackUpdate.wind_direction = historicalReport.wind_direction || 'N/A';
            }
            
            if (newSurfData && newSurfData.water_temp && newSurfData.water_temp !== 'N/A') {
              fallbackUpdate.water_temp = newSurfData.water_temp;
            } else {
              fallbackUpdate.water_temp = historicalReport.water_temp || 'N/A';
            }
            
            console.log('Updating with historical wave data + current conditions:', fallbackUpdate);
            
            const { data: updatedData, error: updateError } = await supabase
              .from('surf_reports')
              .update(fallbackUpdate)
              .eq('date', today)
              .eq('location', locationId)
              .select();
            
            if (updateError) {
              console.error('Error updating with historical data:', updateError);
            } else {
              console.log('✅ Successfully updated with historical wave data');
            }
            
            return new Response(
              JSON.stringify({
                success: true,
                message: `Wave sensors offline - using last successful wave data from ${historicalReport.date}`,
                report: updatedData ? updatedData[0] : existingReport,
                fallbackMode: true,
                fallbackDate: historicalReport.date,
                timestamp: new Date().toISOString(),
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            );
          }
        }
      } else {
        console.log('⚠️ No existing report found for today');
      }

      console.log('❌ No valid buoy data available and no fallback data found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid buoy data available and no fallback data found',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('✅ Valid wave data available from latest buoy fetch');
    console.log('New buoy data:', {
      wave_height: newSurfData.wave_height,
      surf_height: newSurfData.surf_height,
      wind_speed: newSurfData.wind_speed,
      water_temp: newSurfData.water_temp
    });

    // Get the existing report for today and this location to preserve the narrative
    const existingReportResult = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', today)
      .eq('location', locationId)
      .maybeSingle();

    if (!existingReportResult.data) {
      console.log('No existing report found for today - this should only happen if the 5 AM report failed');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No existing report found for today. The 5 AM report generation may have failed.',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const existingReport = existingReportResult.data;

    // Fetch weather data for rating calculation
    const weatherResult = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', today)
      .eq('location', locationId)
      .maybeSingle();

    const weatherData = weatherResult.data;

    // Calculate new rating based on updated buoy data
    const newRating = weatherData ? calculateSurfRating(newSurfData, weatherData) : existingReport.rating;

    // Update only the buoy data fields, preserving the narrative (conditions field)
    const displayHeight = newSurfData.surf_height !== 'N/A' ? newSurfData.surf_height : newSurfData.wave_height;

    const updatedReport = {
      wave_height: displayHeight || 'N/A',
      wave_period: newSurfData.wave_period || 'N/A',
      swell_direction: newSurfData.swell_direction || 'N/A',
      wind_speed: newSurfData.wind_speed || 'N/A',
      wind_direction: newSurfData.wind_direction || 'N/A',
      water_temp: newSurfData.water_temp || 'N/A',
      rating: newRating,
      updated_at: new Date().toISOString(),
      // IMPORTANT: We do NOT update the 'conditions' field - this preserves the 5 AM narrative
    };

    console.log('Updating buoy data while preserving narrative:', updatedReport);

    const { data: updateData, error: updateError } = await supabase
      .from('surf_reports')
      .update(updatedReport)
      .eq('date', today)
      .eq('location', locationId)
      .select();

    if (updateError) {
      console.error('Error updating surf report:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update surf report',
          details: updateError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('=== UPDATE BUOY DATA ONLY COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Buoy data updated successfully for ${locationName} (narrative preserved)`,
        location: locationName,
        locationId: locationId,
        report: updateData[0],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== UPDATE BUOY DATA ONLY FAILED ===');
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
