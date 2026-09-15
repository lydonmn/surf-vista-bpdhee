
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

function generateTideSummary(tideData: any[]): string {
  if (tideData.length === 0) {
    return 'Tide data unavailable';
  }

  const tides = tideData.map(t => `${t.type} at ${t.time} (${t.height}${t.height_unit})`);
  return tides.join(', ');
}

function generateNoWaveDataReportText(weatherData: any, surfData: any, tideData: any[]): string {
  const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
  const windSpeed = surfData.wind_speed || 'N/A';
  const windDir = surfData.wind_direction || 'Variable';
  const waterTemp = surfData.water_temp || 'N/A';
  
  const messages = [
    `The wave sensors on the Edisto buoy aren't reporting right now, so we can't give you wave heights or periods. The buoy is online though - winds are ${windSpeed} from the ${windDir}, water temp is ${waterTemp}, and weather is ${weatherConditions.toLowerCase()}. Check local surf cams or head to the beach to see what's actually happening out there!`,
    `Wave sensors are offline on the buoy today, so no wave data available. Wind is ${windSpeed} from the ${windDir}, water's at ${waterTemp}, and it's ${weatherConditions.toLowerCase()}. Your best bet is to check the beach in person or look at surf cams for current conditions.`,
  ];
  
  const index = Math.floor(Date.now() / 1000) % messages.length;
  return messages[index];
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

function selectRandom<T>(array: T[]): T {
  const index = Math.floor((Date.now() + Math.random() * 1000) / 100) % array.length;
  return array[index];
}

function generateReportText(
  surfData: any, 
  weatherData: any, 
  tideSummary: string, 
  rating: number,
  historicalDate: string | null = null
): string {
  try {
    const heightStr = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;
    
    if (heightStr === 'N/A') {
      return generateNoWaveDataReportText(weatherData, surfData, []);
    }
    
    const surfHeight = parseNumericValue(heightStr, 0);
    const windSpeed = parseNumericValue(surfData.wind_speed, 0);
    const windDir = surfData.wind_direction || 'Variable';
    const swellDir = surfData.swell_direction || 'Variable';
    const period = surfData.wave_period || 'N/A';
    const periodNum = parseNumericValue(period, 0);
    const waterTemp = surfData.water_temp || 'N/A';

    const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
    const isClean = (isOffshore && windSpeed < 15) || (!isOffshore && windSpeed < 8);

    let historicalNote = '';
    if (historicalDate) {
      historicalNote = ` (Note: Wave sensors are currently offline, using wave data from ${historicalDate}. Current wind and water conditions are up to date.)`;
    }

    let report = '';

    if (rating >= 8) {
      const openings = [
        'It\'s absolutely firing out there!',
        'Epic conditions today!',
        'You gotta see this - it\'s going off!',
      ];
      report += selectRandom(openings);
    } else if (rating >= 6) {
      const openings = [
        'Looking pretty fun out there today.',
        'Decent waves rolling through.',
        'Not bad at all - worth checking out.',
      ];
      report += selectRandom(openings);
    } else if (rating >= 4) {
      const openings = [
        'Small but rideable conditions.',
        'Pretty mellow out there.',
        'Not much size but it\'s clean.',
      ];
      report += selectRandom(openings);
    } else {
      const openings = [
        'Pretty flat today.',
        'Not much happening.',
        'Minimal surf conditions.',
      ];
      report += selectRandom(openings);
    }

    report += historicalNote + ' ';

    if (surfHeight >= 7) {
      if (isClean) {
        report += `Massive ${swellDir} swell rolling in, waves are stacking up overhead and peeling perfectly. `;
      } else {
        report += `Big ${swellDir} swell but the wind is tearing it apart, overhead but pretty messy. `;
      }
    } else if (surfHeight >= 4.5) {
      if (isClean) {
        report += `Nice ${swellDir} swell, waves are chest to head high and looking super clean. `;
      } else {
        report += `${swellDir} swell but the wind is adding some texture, chest high but a bit bumpy. `;
      }
    } else if (surfHeight >= 2) {
      if (isClean) {
        report += `Small ${swellDir} swell, waves are waist high and clean. `;
      } else {
        report += `Small ${swellDir} swell and the wind isn\'t helping, waist high but choppy. `;
      }
    } else {
      report += `Minimal swell, ankle to knee high at best. `;
    }

    if (isOffshore && windSpeed < 10) {
      report += `Light offshore winds at ${windSpeed} mph from the ${windDir} are grooming the faces nicely. `;
    } else if (isOffshore && windSpeed < 15) {
      report += `Offshore winds at ${windSpeed} mph from the ${windDir} are keeping it clean. `;
    } else if (!isOffshore && windSpeed < 8) {
      report += `Light onshore winds at ${windSpeed} mph from the ${windDir}, not too bad. `;
    } else if (!isOffshore) {
      report += `Onshore winds at ${windSpeed} mph from the ${windDir} are making it bumpy. `;
    }

    if (periodNum >= 12) {
      report += `Long period swell at ${period} means powerful waves with good shape. `;
    } else if (periodNum >= 8) {
      report += `Decent period at ${period} giving the waves some push. `;
    } else if (periodNum > 0) {
      report += `Short period at ${period}, waves are a bit choppy. `;
    }

    const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
    report += `Weather is ${weatherConditions.toLowerCase()} and water temp is ${waterTemp}. `;

    if (rating >= 8) {
      const closings = [
        'Drop everything and get out here!',
        'This is the one you don\'t want to miss!',
        'Absolutely worth the session!',
      ];
      report += selectRandom(closings);
    } else if (rating >= 6) {
      const closings = [
        'Definitely worth checking out if you\'ve got time.',
        'Should be a fun session.',
        'Worth the paddle out.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 4) {
      const closings = [
        'Could be fun for beginners or longboarders.',
        'Decent for a mellow session.',
        'Not epic but rideable.',
      ];
      report += selectRandom(closings);
    } else {
      const closings = [
        'Maybe wait for the next swell.',
        'Check back tomorrow, might be better.',
        'Not really worth it today.',
      ];
      report += selectRandom(closings);
    }

    return report;
  } catch (error) {
    console.error('Error generating report text:', error);
    return 'Unable to generate surf report at this time. Please check back later.';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== GENERATE FIRST DAILY REPORT STARTED (5 AM) ===');
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

    const today = getESTDate();
    console.log('Current EST date:', today);

    // Check if we already have a report for today with a narrative
    const existingReportResult = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (existingReportResult.data && existingReportResult.data.conditions && existingReportResult.data.conditions.length > 50) {
      console.log('Report already exists for today with narrative, skipping generation');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'First daily report already exists for today',
          report: existingReportResult.data,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fetch surf data for today
    let surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    let historicalDataDate: string | null = null;
    
    if (!surfResult.data) {
      console.log('No surf data for today, fetching most recent...');
      surfResult = await supabase
        .from('surf_conditions')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (surfResult.data) {
        historicalDataDate = surfResult.data.date;
        console.log('Using historical surf data from:', historicalDataDate);
      }
    }

    // Fetch weather data for today
    let weatherResult = await supabase
      .from('weather_data')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (!weatherResult.data) {
      console.log('No weather data for today, fetching most recent...');
      weatherResult = await supabase
        .from('weather_data')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    // Fetch tide data for today
    const tideResult = await supabase
      .from('tide_data')
      .select('*')
      .eq('date', today)
      .order('time');

    if (surfResult.error || weatherResult.error || tideResult.error) {
      console.error('Error fetching data');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch required data',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const surfData = surfResult.data;
    const weatherData = weatherResult.data;
    const tideData = tideResult.data || [];

    if (!surfData || !weatherData) {
      const errorMsg = 'Missing required data for report generation. Buoy data may be unavailable - will retry.';
      console.error(errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Check if we have valid wave data (required for narrative generation)
    const hasValidWaveData = surfData.wave_height !== 'N/A' || surfData.surf_height !== 'N/A';
    
    if (!hasValidWaveData) {
      const errorMsg = 'No valid wave data available - will retry until wave sensors report data';
      console.log(errorMsg);
      console.log('Current surf data:', {
        wave_height: surfData.wave_height,
        surf_height: surfData.surf_height,
        wind_speed: surfData.wind_speed,
        water_temp: surfData.water_temp
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          hasWeatherData: !!weatherData,
          hasTideData: tideData.length > 0,
          hasSurfData: !!surfData,
          hasValidWaveData: false,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('✅ Valid wave data available, proceeding with narrative generation');
    console.log('Wave data:', {
      wave_height: surfData.wave_height,
      surf_height: surfData.surf_height,
      wave_period: surfData.wave_period,
      swell_direction: surfData.swell_direction
    });

    // Generate report with valid wave data
    const tideSummary = generateTideSummary(tideData);
    const rating = calculateSurfRating(surfData, weatherData);
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating, historicalDataDate);

    const displayHeight = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;

    const surfReport = {
      date: today,
      wave_height: displayHeight || 'N/A',
      wave_period: surfData.wave_period || 'N/A',
      swell_direction: surfData.swell_direction || 'N/A',
      wind_speed: surfData.wind_speed || 'N/A',
      wind_direction: surfData.wind_direction || 'N/A',
      water_temp: surfData.water_temp || 'N/A',
      tide: tideSummary || 'Tide data unavailable',
      conditions: reportText,
      rating: rating,
      updated_at: new Date().toISOString(),
    };

    // Delete old report for today
    const { error: deleteError } = await supabase
      .from('surf_reports')
      .delete()
      .eq('date', today);

    // Insert new report
    const { data: insertData, error: reportError } = await supabase
      .from('surf_reports')
      .insert(surfReport)
      .select();

    if (reportError) {
      console.error('Error storing surf report:', reportError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to store surf report',
          details: reportError.message,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('=== GENERATE FIRST DAILY REPORT COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'First daily surf report generated successfully with narrative',
        report: surfReport,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== GENERATE FIRST DAILY REPORT FAILED ===');
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
