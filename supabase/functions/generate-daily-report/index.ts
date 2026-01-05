
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
    `Hey folks, the wave sensors on the Edisto buoy aren&apos;t reporting right now, so we can&apos;t give you wave heights or periods. The buoy is online though - we&apos;re seeing ${windSpeed} winds from the ${windDir}, water temp is ${waterTemp}, and weather is ${weatherConditions.toLowerCase()}. Check local surf cams or head to the beach to see what&apos;s actually happening out there!`,
    `Wave sensors are offline on the buoy today, so no wave data available. But we do know the wind is ${windSpeed} from the ${windDir}, water&apos;s at ${waterTemp}, and it&apos;s ${weatherConditions.toLowerCase()}. Your best bet is to check the beach in person or look at surf cams for current conditions.`,
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

    if (surfHeight <= 3) {
      rating = conditions === 'clean' ? 3 : Math.min(3, Math.max(1, 3 - (windSpeed / 10)));
    } else if (surfHeight > 3 && surfHeight < 4.5) {
      rating = conditions === 'clean' ? 4 : 3;
    } else if (surfHeight >= 4.5 && surfHeight <= 6) {
      if (conditions === 'clean') {
        rating = 7;
      } else if (conditions === 'moderate') {
        rating = 6;
      } else if (conditions === 'moderately poor') {
        rating = 5;
      } else if (conditions === 'poor') {
        rating = 4;
      } else if (conditions === 'very poor') {
        rating = 3;
      } else {
        rating = 5;
      }
    } else if (surfHeight >= 7) {
      if (conditions === 'clean') {
        rating = 10;
      } else if (conditions === 'moderate') {
        rating = 8;
      } else if (conditions === 'poor') {
        rating = 7;
      } else if (conditions === 'very poor') {
        rating = 6;
      } else {
        rating = 7;
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

    const openings = [
      { min: 8, phrases: ['Yo, it&apos;s absolutely firing out there!', 'Dude, you gotta see this!', 'Holy smokes, it&apos;s going off!'] },
      { min: 6, phrases: ['Hey, it&apos;s looking pretty fun out there.', 'Not bad at all today!', 'Yeah, there&apos;s some decent waves rolling through.'] },
      { min: 4, phrases: ['It&apos;s small but clean, could be fun.', 'Pretty mellow out there today.', 'Not much size but it&apos;s rideable.'] },
      { min: 0, phrases: ['Honestly, it&apos;s pretty flat.', 'Not much happening today.', 'Yeah, it&apos;s basically a lake.'] }
    ];

    let opening = 'Checked the surf this morning.';
    for (const o of openings) {
      if (rating >= o.min) {
        opening = selectRandom(o.phrases);
        break;
      }
    }

    let report = `${opening}${historicalNote} `;

    if (surfHeight >= 7) {
      const swellDescriptions = isClean 
        ? [`We&apos;ve got this massive ${swellDir} swell rolling in, waves are stacking up overhead and just peeling perfectly`]
        : [`There&apos;s a big ${swellDir} swell but the wind is tearing it apart, overhead but pretty messy`];
      report += `${selectRandom(swellDescriptions)}. `;
    } else if (surfHeight >= 4.5) {
      const swellDescriptions = isClean 
        ? [`We&apos;ve got a nice ${swellDir} swell, waves are coming through chest to head high and looking super clean`]
        : [`There&apos;s a ${swellDir} swell but the wind is adding some texture, chest high but a bit bumpy`];
      report += `${selectRandom(swellDescriptions)}. `;
    } else if (surfHeight >= 2) {
      const swellDescriptions = isClean 
        ? [`Small ${swellDir} swell, waves are waist high and clean though`]
        : [`Small ${swellDir} swell and the wind isn&apos;t helping, waist high but choppy`];
      report += `${selectRandom(swellDescriptions)}. `;
    } else {
      report += `Honestly, there&apos;s just no swell at all, it&apos;s completely flat. `;
    }

    const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
    report += `Weather is ${weatherConditions.toLowerCase()} and water temp is ${waterTemp}. `;

    const closings = {
      high: ['Seriously, drop what you&apos;re doing and get out here!', 'This is the one you don&apos;t want to miss!'],
      medium: ['Definitely worth checking out if you&apos;ve got time.', 'Should be a fun session, worth the paddle.'],
      low: ['Maybe wait for the next swell, this one&apos;s not worth it.', 'Check back tomorrow, might be better.']
    };

    let closingPhrase = '';
    if (rating >= 7) {
      closingPhrase = selectRandom(closings.high);
    } else if (rating >= 4) {
      closingPhrase = selectRandom(closings.medium);
    } else {
      closingPhrase = selectRandom(closings.low);
    }

    report += closingPhrase;

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
    console.log('=== GENERATE DAILY REPORT STARTED ===');
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

    let surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (!surfResult.data) {
      console.log('No surf data for today, fetching most recent...');
      surfResult = await supabase
        .from('surf_conditions')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

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
      const errorMsg = 'Missing required data for report generation. Please run "Update All Data" first.';
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

    const hasValidWaveData = surfData.wave_height !== 'N/A' || surfData.surf_height !== 'N/A';
    
    if (!hasValidWaveData) {
      const tideSummary = generateTideSummary(tideData);
      const noWaveDataReport = {
        date: today,
        wave_height: 'N/A',
        wave_period: 'N/A',
        swell_direction: 'N/A',
        wind_speed: surfData.wind_speed || 'N/A',
        wind_direction: surfData.wind_direction || 'N/A',
        water_temp: surfData.water_temp || 'N/A',
        tide: tideSummary || 'Tide data unavailable',
        conditions: generateNoWaveDataReportText(weatherData, surfData, tideData),
        rating: 0,
        updated_at: new Date().toISOString(),
      };

      const { error: deleteError } = await supabase
        .from('surf_reports')
        .delete()
        .eq('date', today);

      const { data: insertData, error: reportError } = await supabase
        .from('surf_reports')
        .insert(noWaveDataReport)
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

      console.log('=== GENERATE DAILY REPORT COMPLETED (NO WAVE DATA) ===');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Daily surf report generated (wave sensors offline)',
          report: noWaveDataReport,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const tideSummary = generateTideSummary(tideData);
    const rating = calculateSurfRating(surfData, weatherData);
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating, null);

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

    const { error: deleteError } = await supabase
      .from('surf_reports')
      .delete()
      .eq('date', today);

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

    console.log('=== GENERATE DAILY REPORT COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily surf report generated successfully',
        report: surfReport,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== GENERATE DAILY REPORT FAILED ===');
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
