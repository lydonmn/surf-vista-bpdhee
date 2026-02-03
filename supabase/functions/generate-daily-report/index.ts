
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
    
    // Offshore winds (W, NW, N, NE) are good for surf
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
      // Onshore winds (E, SE, S, SW) are bad for surf
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
    
    // Short period waves are choppy
    if (period < 6 && conditions === 'clean') {
      conditions = 'moderate';
    } else if (period < 6 && conditions === 'moderate') {
      conditions = 'poor';
    }

    let rating = 0;

    // Rating based on surf height and conditions
    if (surfHeight <= 1.5) {
      // Flat to ankle high
      rating = conditions === 'clean' ? 2 : 1;
    } else if (surfHeight <= 3) {
      // Knee to waist high
      rating = conditions === 'clean' ? 4 : Math.max(2, 4 - Math.floor(windSpeed / 10));
    } else if (surfHeight > 3 && surfHeight < 4.5) {
      // Waist to chest high
      rating = conditions === 'clean' ? 6 : 4;
    } else if (surfHeight >= 4.5 && surfHeight <= 6) {
      // Chest to head high
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
      // Overhead+
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
  historicalDate: string | null = null,
  tideData: any[] = []
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

    // Build the report with comprehensive details
    let report = '';

    // Opening based on rating with more context
    if (rating >= 8) {
      const openings = [
        'It\'s absolutely firing out there!',
        'Epic conditions today!',
        'You gotta see this - it\'s going off!',
        'Premium surf conditions right now!',
      ];
      report += selectRandom(openings);
    } else if (rating >= 6) {
      const openings = [
        'Looking pretty fun out there today.',
        'Decent waves rolling through.',
        'Not bad at all - worth checking out.',
        'Solid conditions for a session.',
      ];
      report += selectRandom(openings);
    } else if (rating >= 4) {
      const openings = [
        'Small but rideable conditions.',
        'Pretty mellow out there.',
        'Not much size but it\'s clean.',
        'Manageable conditions for all levels.',
      ];
      report += selectRandom(openings);
    } else {
      const openings = [
        'Pretty flat today.',
        'Not much happening.',
        'Minimal surf conditions.',
        'Small day at the beach.',
      ];
      report += selectRandom(openings);
    }

    report += historicalNote + ' ';

    // DETAILED SURF SIZE AND CONDITIONS
    report += '\n\n🌊 SURF CONDITIONS: ';
    
    // Detailed wave height description
    if (surfHeight >= 7) {
      report += `We're seeing a massive ${swellDir} swell with waves stacking up overhead at ${heightStr} feet. `;
      if (isClean) {
        report += `The faces are clean and well-formed, offering powerful rides with plenty of push. `;
      } else {
        report += `However, the wind is creating some texture on the faces, making it challenging but still rideable for experienced surfers. `;
      }
    } else if (surfHeight >= 4.5) {
      report += `A solid ${swellDir} swell is delivering chest to head high waves at ${heightStr} feet. `;
      if (isClean) {
        report += `The wave faces are glassy and well-shaped, perfect for carving and generating speed. `;
      } else {
        report += `There's some wind chop on the faces, but the size makes up for it with plenty of power. `;
      }
    } else if (surfHeight >= 2) {
      report += `A small ${swellDir} swell is producing waist to chest high waves at ${heightStr} feet. `;
      if (isClean) {
        report += `The conditions are clean and organized, ideal for practicing maneuvers and longboarding. `;
      } else {
        report += `The wind is adding some bump to the faces, making it a bit choppy but still fun. `;
      }
    } else if (surfHeight >= 1) {
      report += `Minimal swell with ankle to knee high waves at ${heightStr} feet. `;
      if (isClean) {
        report += `Despite the small size, the faces are smooth - perfect for beginners or longboard cruising. `;
      } else {
        report += `The small size combined with wind chop makes it challenging, best for practicing pop-ups. `;
      }
    } else {
      report += `Very minimal swell with waves barely reaching ankle high at ${heightStr} feet. `;
      report += `Better suited for swimming or stand-up paddleboarding than surfing today. `;
    }

    // DETAILED WAVE PERIOD AND QUALITY
    if (periodNum >= 12) {
      report += `The wave period is ${period} seconds, which is excellent - these are long-period groundswells that pack serious punch and create well-defined sets with clean intervals between waves. `;
    } else if (periodNum >= 10) {
      report += `Wave period is ${period} seconds, indicating a good quality swell with decent power and organized sets. `;
    } else if (periodNum >= 8) {
      report += `Wave period is ${period} seconds, providing moderate energy with reasonably spaced sets. `;
    } else if (periodNum >= 6) {
      report += `Wave period is ${period} seconds, which is on the shorter side - expect more frequent but less powerful waves with shorter rides. `;
    } else if (periodNum > 0) {
      report += `Short wave period at ${period} seconds means choppy, wind-driven waves with limited power and quick, bumpy rides. `;
    }

    // DETAILED WIND CONDITIONS
    report += '\n\n💨 WIND CONDITIONS: ';
    
    if (isOffshore) {
      if (windSpeed < 5) {
        report += `Nearly calm offshore winds at ${windSpeed} mph from the ${windDir} are creating pristine, glassy conditions. The wave faces are smooth as silk, allowing for maximum performance and clean barrels. `;
      } else if (windSpeed < 10) {
        report += `Light offshore winds at ${windSpeed} mph from the ${windDir} are grooming the wave faces beautifully. Expect clean, well-shaped waves with excellent form and hollow sections. `;
      } else if (windSpeed < 15) {
        report += `Moderate offshore winds at ${windSpeed} mph from the ${windDir} are holding up the wave faces and creating some nice barrel opportunities, though it might get a bit gusty. `;
      } else if (windSpeed < 20) {
        report += `Strong offshore winds at ${windSpeed} mph from the ${windDir} are blowing hard - while this cleans up the faces, it can make paddling out challenging and blow out the tops of waves. `;
      } else {
        report += `Very strong offshore winds at ${windSpeed} mph from the ${windDir} are creating difficult conditions. The wind is so strong it's blowing the tops off waves and making it hard to paddle. `;
      }
    } else {
      if (windSpeed < 5) {
        report += `Nearly calm onshore winds at ${windSpeed} mph from the ${windDir} aren't causing much texture. Conditions are relatively smooth despite the wind direction. `;
      } else if (windSpeed < 8) {
        report += `Light onshore winds at ${windSpeed} mph from the ${windDir} are adding slight texture to the faces but nothing too disruptive. Still very surfable. `;
      } else if (windSpeed < 12) {
        report += `Moderate onshore winds at ${windSpeed} mph from the ${windDir} are creating noticeable chop on the wave faces. Expect bumpy rides and less defined shape. `;
      } else if (windSpeed < 18) {
        report += `Strong onshore winds at ${windSpeed} mph from the ${windDir} are making conditions quite choppy and disorganized. The waves are breaking irregularly with lots of texture. `;
      } else {
        report += `Very strong onshore winds at ${windSpeed} mph from the ${windDir} are creating blown-out conditions. The waves are messy, choppy, and breaking unpredictably. `;
      }
    }

    // DETAILED WEATHER CONDITIONS
    report += '\n\n☀️ WEATHER: ';
    const weatherConditions = weatherData.conditions || weatherData.short_forecast || 'Weather data unavailable';
    const temp = weatherData.temperature ? `${weatherData.temperature}°F` : 'temperature unavailable';
    
    report += `Current conditions are ${weatherConditions.toLowerCase()}`;
    if (weatherData.temperature) {
      report += ` with air temperature at ${temp}`;
    }
    report += `. Water temperature is ${waterTemp}, `;
    
    const waterTempNum = parseNumericValue(waterTemp, 0);
    if (waterTempNum >= 75) {
      report += `which is warm and comfortable - boardshorts or a spring suit will do. `;
    } else if (waterTempNum >= 68) {
      report += `which is pleasant - a spring suit or thin wetsuit recommended. `;
    } else if (waterTempNum >= 60) {
      report += `which is cool - a 3/2mm wetsuit is recommended for comfort. `;
    } else if (waterTempNum >= 50) {
      report += `which is cold - you'll want a 4/3mm wetsuit with booties. `;
    } else if (waterTempNum > 0) {
      report += `which is very cold - a 5/4mm wetsuit with hood, gloves, and booties is essential. `;
    }

    // DETAILED TIDE INFORMATION
    if (tideData && tideData.length > 0) {
      report += '\n\n🌙 TIDE SCHEDULE: ';
      
      // Find current tide phase
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/New_York'
      });
      
      let currentTidePhase = '';
      for (let i = 0; i < tideData.length - 1; i++) {
        const currentTide = tideData[i];
        const nextTide = tideData[i + 1];
        
        if (currentTime >= currentTide.time && currentTime < nextTide.time) {
          if (currentTide.type.toLowerCase() === 'low') {
            currentTidePhase = `Currently on an incoming tide (rising from ${currentTide.height}${currentTide.height_unit} low to ${nextTide.height}${nextTide.height_unit} high at ${nextTide.time}). `;
          } else {
            currentTidePhase = `Currently on an outgoing tide (dropping from ${currentTide.height}${currentTide.height_unit} high to ${nextTide.height}${nextTide.height_unit} low at ${nextTide.time}). `;
          }
          break;
        }
      }
      
      report += currentTidePhase;
      report += `Today's tide schedule: `;
      
      const tideDescriptions = tideData.map(t => {
        const tideType = t.type.toLowerCase() === 'high' ? 'High' : 'Low';
        return `${tideType} tide at ${t.time} (${t.height}${t.height_unit})`;
      });
      
      report += tideDescriptions.join(', ');
      report += `. `;
      
      // Add tide advice
      const hasHighTide = tideData.some(t => t.type.toLowerCase() === 'high');
      const hasLowTide = tideData.some(t => t.type.toLowerCase() === 'low');
      
      if (surfHeight >= 4) {
        report += `With this size swell, mid to high tide will offer the best shape and power. `;
      } else if (surfHeight >= 2) {
        report += `Mid tide usually offers the best balance of wave shape and rideable sections. `;
      } else {
        report += `Low to mid tide might give you the best chance at catching the available waves. `;
      }
    }

    // COMPREHENSIVE CLOSING RECOMMENDATION
    report += '\n\n📋 RECOMMENDATION: ';
    
    if (rating >= 8) {
      const closings = [
        'Drop everything and get out here! These are the conditions you dream about - clean faces, good size, and perfect wind. This is a session you\'ll be talking about for weeks.',
        'This is the one you don\'t want to miss! Everything is lining up perfectly. Call in sick, skip the meeting, do whatever you need to do - you need to be in the water right now.',
        'Absolutely worth the session! Premium conditions like this don\'t come around often. The stars have aligned with size, wind, and tide all working together.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 6) {
      const closings = [
        'Definitely worth checking out if you\'ve got time. The conditions are solid and you\'ll get some quality rides. Bring your standard shortboard and enjoy the session.',
        'Should be a fun session. Nothing epic, but definitely good enough to make it worth your while. You\'ll get plenty of waves and have a good time out there.',
        'Worth the paddle out. The conditions are clean enough and there\'s enough size to make it enjoyable. A solid session awaits if you can make it.',
      ];
      report += selectRandom(closings);
    } else if (rating >= 4) {
      const closings = [
        'Could be fun for beginners or longboarders. The small size and manageable conditions make it perfect for learning or cruising. Bring the log and enjoy some mellow rides.',
        'Decent for a mellow session. Don\'t expect anything epic, but if you\'re looking to get wet and practice your fundamentals, it\'s worth it. Great for working on technique.',
        'Not epic but rideable. If you\'re itching to surf and don\'t mind small waves, you can still have fun out there. Perfect for a casual session or teaching someone.',
      ];
      report += selectRandom(closings);
    } else {
      const closings = [
        'Maybe wait for the next swell. The conditions today are pretty minimal and you\'d probably have more fun doing something else. Check back tomorrow or later this week.',
        'Check back tomorrow, might be better. Today\'s not really worth the effort unless you\'re desperate to get wet. Save your energy for when conditions improve.',
        'Not really worth it today. The surf is too small and conditions aren\'t great. Better to wait for a better swell or spend your time on other activities.',
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
    console.log('=== GENERATE DAILY REPORT STARTED ===');
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
    console.log('Generating report for:', locationName);
    
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

    // Fetch surf data for today
    let surfResult = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .eq('location', locationId)
      .maybeSingle();

    let historicalDataDate: string | null = null;
    
    if (!surfResult.data) {
      console.log('No surf data for today, fetching most recent...');
      surfResult = await supabase
        .from('surf_conditions')
        .select('*')
        .eq('location', locationId)
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
      .eq('location', locationId)
      .maybeSingle();

    if (!weatherResult.data) {
      console.log('No weather data for today, fetching most recent...');
      weatherResult = await supabase
        .from('weather_data')
        .select('*')
        .eq('location', locationId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    // Fetch tide data for today
    const tideResult = await supabase
      .from('tide_data')
      .select('*')
      .eq('date', today)
      .eq('location', locationId)
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
        location: locationId,
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

      // Delete old report for today
      const { error: deleteError } = await supabase
        .from('surf_reports')
        .delete()
        .eq('date', today)
        .eq('location', locationId);

      // Insert new report
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
          message: `Daily surf report generated for ${locationName} (wave sensors offline)`,
          location: locationName,
          locationId: locationId,
          report: noWaveDataReport,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Generate report with valid wave data
    const tideSummary = generateTideSummary(tideData);
    const rating = calculateSurfRating(surfData, weatherData);
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating, historicalDataDate, tideData);

    const displayHeight = surfData.surf_height !== 'N/A' ? surfData.surf_height : surfData.wave_height;

    const surfReport = {
      date: today,
      location: locationId,
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
      .eq('date', today)
      .eq('location', locationId);

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

    console.log('=== GENERATE DAILY REPORT COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily surf report generated successfully for ${locationName}`,
        location: locationName,
        locationId: locationId,
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
