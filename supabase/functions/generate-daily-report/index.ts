
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

// Location-specific personality traits - UPDATED WITH ALL LOCATIONS
const LOCATION_PERSONALITIES: Record<string, {
  casual: string[];
  excited: string[];
  disappointed: string[];
  nickname: string;
}> = {
  'folly-beach': {
    casual: ['Folly', 'the Edge of America', 'Folly Beach'],
    excited: ['Folly is firing', 'Folly is going off', 'Folly is pumping'],
    disappointed: ['not much happening at Folly', 'Folly is pretty flat', 'Folly is taking a rest'],
    nickname: 'Folly Beach'
  },
  'pawleys-island': {
    casual: ['Pawleys', 'the island', 'Pawleys Island'],
    excited: ['Pawleys has swell', 'Pawleys is working', 'Pawleys is delivering'],
    disappointed: ['not a wave on Pawleys', 'Pawleys is dead flat', 'Pawleys is sleeping'],
    nickname: 'Pawleys Island'
  },
  'holden-beach-nc': {
    casual: ['Holden', 'Holden Beach', 'the beach'],
    excited: ['Holden is cranking', 'Holden has waves', 'Holden is alive'],
    disappointed: ['Holden is flat', 'nothing at Holden', 'Holden is quiet'],
    nickname: 'Holden Beach'
  },
  'rexhame-beach,-massachusetts-': {
    casual: ['Marshfield', 'Rexhame Beach', 'the beach'],
    excited: ['Marshfield is firing', 'Marshfield has swell', 'Marshfield is pumping'],
    disappointed: ['not much at Marshfield', 'Marshfield is flat', 'Marshfield is quiet'],
    nickname: 'Marshfield'
  },
  'marshfield-ma': {
    casual: ['Marshfield', 'Rexhame Beach', 'the beach'],
    excited: ['Marshfield is firing', 'Marshfield has swell', 'Marshfield is pumping'],
    disappointed: ['not much at Marshfield', 'Marshfield is flat', 'Marshfield is quiet'],
    nickname: 'Marshfield'
  },
  'cisco-beach': {
    casual: ['Cisco', 'Cisco Beach', 'the beach'],
    excited: ['Cisco is firing', 'Cisco has swell', 'Cisco is pumping'],
    disappointed: ['not much at Cisco', 'Cisco is flat', 'Cisco is quiet'],
    nickname: 'Cisco Beach'
  },
  'cisco-beach-nantucket': {
    casual: ['Cisco', 'Cisco Beach', 'the beach'],
    excited: ['Cisco is firing', 'Cisco has swell', 'Cisco is pumping'],
    disappointed: ['not much at Cisco', 'Cisco is flat', 'Cisco is quiet'],
    nickname: 'Cisco Beach'
  },
  'jupiter-florida': {
    casual: ['Jupiter', 'Jupiter Inlet', 'the inlet'],
    excited: ['Jupiter is firing', 'Jupiter has swell', 'Jupiter is pumping'],
    disappointed: ['not much at Jupiter', 'Jupiter is flat', 'Jupiter is quiet'],
    nickname: 'Jupiter Inlet'
  }
};

function getLocationPersonality(locationId: string) {
  console.log('[getLocationPersonality] Looking up personality for:', locationId);
  const personality = LOCATION_PERSONALITIES[locationId] || {
    casual: [locationId.replace(/-/g, ' ')],
    excited: [`${locationId.replace(/-/g, ' ')} is firing`],
    disappointed: [`not much at ${locationId.replace(/-/g, ' ')}`],
    nickname: locationId.replace(/-/g, ' ')
  };
  console.log('[getLocationPersonality] Using personality for:', personality.nickname);
  return personality;
}

function generateNoWaveDataReportText(weatherData: any, surfData: any, tideData: any[], locationId: string): string {
  const personality = getLocationPersonality(locationId);
  console.log('[generateNoWaveDataReportText] 🏖️ Generating for location:', personality.nickname);
  
  const windSpeed = parseNumericValue(surfData.wind_speed, 0);
  const windDir = surfData.wind_direction || 'variable';
  const waterTemp = parseNumericValue(surfData.water_temp, 0);
  const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'conditions unknown';
  
  const windText = windSpeed > 0 ? `${windSpeed.toFixed(0)} mph ${windDir}` : 'calm';
  const waterText = waterTemp > 0 ? `${waterTemp.toFixed(0)}°F` : 'unknown temp';
  
  const messages = [
    `The wave sensors are offline today at ${personality.nickname}, so we can't give you exact wave heights. The buoy is still reporting though - wind is ${windText}, water is ${waterText}, and it's ${weatherConditions.toLowerCase()}. Best bet is to check the beach cam or drive down to see what's actually out there.`,
    
    `Wave sensors aren't working at ${personality.nickname} right now. We've got wind at ${windText}, water temp at ${waterText}, and ${weatherConditions.toLowerCase()} skies, but no wave data. Check the local surf cam or head down to scout it yourself.`,
    
    `Buoy sensors are down at ${personality.nickname} today - no wave readings available. Wind is ${windText}, water's ${waterText}, weather is ${weatherConditions.toLowerCase()}. You'll need to eyeball it from the beach or check a surf cam for current conditions.`
  ];
  
  const seed = locationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Date.now() / 86400000);
  const selectedMessage = messages[seed % messages.length];
  
  console.log('[generateNoWaveDataReportText] ✅ Generated message for', personality.nickname);
  console.log('[generateNoWaveDataReportText] 📄 Preview:', selectedMessage.substring(0, 100));
  console.log('[generateNoWaveDataReportText] 🔍 Location check:', selectedMessage.includes(personality.nickname) ? '✅ CORRECT' : '❌ WRONG');
  
  return selectedMessage;
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
  historicalDate: string | null = null,
  tideData: any[] = []
): string {
  try {
    const locationId = surfData.location || 'folly-beach';
    const personality = getLocationPersonality(locationId);
    
    console.log('[generateReportText] 🏖️ Generating report for location:', personality.nickname);
    console.log('[generateReportText] 🆔 Location ID:', locationId);
    
    const rideableFaceStr = surfData.surf_height || surfData.wave_height;
    
    if (!rideableFaceStr || rideableFaceStr === 'N/A') {
      console.log('[generateReportText] ⚠️ No wave data, generating fallback narrative');
      return generateNoWaveDataReportText(weatherData, surfData, tideData, locationId);
    }
    
    const waveHeight = parseNumericValue(rideableFaceStr, 0);
    const windSpeed = parseNumericValue(surfData.wind_speed, 0);
    const windDir = surfData.wind_direction || 'variable';
    const swellDir = surfData.swell_direction || 'mixed';
    const period = parseNumericValue(surfData.wave_period, 0);
    const waterTemp = parseNumericValue(surfData.water_temp, 0);
    const airTemp = parseNumericValue(weatherData?.temperature, 0);
    const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'partly cloudy';

    const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
    
    // Create unique seed per location per day
    const seed = locationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Date.now() / 86400000);

    let report = '';

    // OPENING - Location-specific and rating-based
    console.log('[generateReportText] 📝 Building opening for', personality.nickname);
    if (rating >= 8) {
      const openings = [
        `${personality.excited[seed % personality.excited.length]} today!`,
        `Epic session at ${personality.nickname} right now.`,
        `You need to see ${personality.nickname} today - it's incredible.`,
      ];
      report += openings[seed % openings.length];
    } else if (rating >= 6) {
      const openings = [
        `${personality.casual[seed % personality.casual.length]} is looking fun today.`,
        `Solid conditions at ${personality.nickname}.`,
        `Worth checking out ${personality.nickname} today.`,
      ];
      report += openings[seed % openings.length];
    } else if (rating >= 4) {
      const openings = [
        `Small but rideable at ${personality.nickname}.`,
        `Mellow day at ${personality.nickname}.`,
        `${personality.nickname} has some small waves.`,
      ];
      report += openings[seed % openings.length];
    } else {
      const openings = [
        `${personality.disappointed[seed % personality.disappointed.length]} today.`,
        `Pretty quiet at ${personality.nickname}.`,
        `Minimal surf at ${personality.nickname} right now.`,
      ];
      report += openings[seed % openings.length];
    }

    if (historicalDate) {
      report += ` (Wave sensor data from ${historicalDate}, but wind and water temps are current.)`;
    }

    console.log('[generateReportText] ✅ Opening added (location:', personality.nickname, '):', report.substring(0, 100));

    // WAVE CONDITIONS - Natural language, no redundant units
    report += '\n\n';
    
    if (waveHeight >= 7) {
      report += `Overhead sets rolling in from the ${swellDir}`;
      if (waveHeight >= 10) {
        report += ` - we're talking ${waveHeight.toFixed(1)} foot faces, well overhead`;
      } else {
        report += ` with ${waveHeight.toFixed(1)} foot faces`;
      }
    } else if (waveHeight >= 4.5) {
      report += `Chest to head high ${swellDir} swell with ${waveHeight.toFixed(1)} foot faces`;
    } else if (waveHeight >= 2.5) {
      report += `Waist to chest high waves from the ${swellDir}, faces around ${waveHeight.toFixed(1)} feet`;
    } else if (waveHeight >= 1.5) {
      report += `Knee to waist high surf, ${waveHeight.toFixed(1)} foot faces from the ${swellDir}`;
    } else if (waveHeight >= 0.5) {
      report += `Ankle to knee high ripples, barely ${waveHeight.toFixed(1)} feet`;
    } else {
      report += `Essentially flat - less than a foot`;
    }
    
    report += '. ';

    // WAVE PERIOD - Natural description
    if (period >= 12) {
      report += `Long ${period.toFixed(0)} second intervals mean powerful groundswell with clean sets and long rides.`;
    } else if (period >= 10) {
      report += `${period.toFixed(0)} second period - decent power and organized sets.`;
    } else if (period >= 8) {
      report += `${period.toFixed(0)} second period gives moderate energy, reasonably spaced waves.`;
    } else if (period >= 6) {
      report += `Shorter ${period.toFixed(0)} second period means more frequent but weaker waves.`;
    } else if (period > 0) {
      report += `Quick ${period.toFixed(0)} second period - choppy wind swell with limited power.`;
    }

    // WIND - Conversational and informative
    report += '\n\n';
    
    if (isOffshore) {
      if (windSpeed < 5) {
        report += `Light ${windSpeed.toFixed(0)} mph ${windDir} breeze - glassy conditions.`;
      } else if (windSpeed < 10) {
        report += `${windSpeed.toFixed(0)} mph offshore ${windDir} wind grooming the faces nicely.`;
      } else if (windSpeed < 15) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} offshore - holding up the faces but getting strong.`;
      } else if (windSpeed < 20) {
        report += `Strong ${windSpeed.toFixed(0)} mph ${windDir} offshore making it tough to paddle out.`;
      } else {
        report += `Howling ${windSpeed.toFixed(0)} mph ${windDir} offshore - blowing the tops off and making it difficult.`;
      }
    } else {
      if (windSpeed < 5) {
        report += `Calm ${windSpeed.toFixed(0)} mph ${windDir} wind - minimal texture.`;
      } else if (windSpeed < 8) {
        report += `Light ${windSpeed.toFixed(0)} mph ${windDir} onshore adding slight chop.`;
      } else if (windSpeed < 12) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} onshore creating bumpy conditions.`;
      } else if (windSpeed < 18) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} onshore - pretty choppy out there.`;
      } else {
        report += `Strong ${windSpeed.toFixed(0)} mph ${windDir} onshore - blown out and messy.`;
      }
    }

    // WEATHER & WATER TEMP - Combined naturally
    report += '\n\n';
    
    const airTempText = airTemp > 0 ? `${airTemp.toFixed(0)}°F air` : '';
    const waterTempText = waterTemp > 0 ? `${waterTemp.toFixed(0)}°F water` : '';
    
    if (airTempText && waterTempText) {
      report += `${weatherConditions} with ${airTempText}, ${waterTempText}. `;
    } else if (waterTempText) {
      report += `${weatherConditions}, ${waterTempText}. `;
    } else {
      report += `${weatherConditions}. `;
    }
    
    // Wetsuit recommendation
    if (waterTemp >= 75) {
      report += `Boardshorts weather.`;
    } else if (waterTemp >= 68) {
      report += `Spring suit or thin wetsuit recommended.`;
    } else if (waterTemp >= 60) {
      report += `3/2mm wetsuit will keep you comfortable.`;
    } else if (waterTemp >= 50) {
      report += `4/3mm wetsuit with booties needed.`;
    } else if (waterTemp > 0) {
      report += `5/4mm with hood, gloves, and booties - it's cold.`;
    }

    // TIDE - Simplified and actionable
    if (tideData && tideData.length > 0) {
      report += '\n\n';
      
      const now = new Date();
      const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const currentTimeStr = estNow.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/New_York'
      });
      
      let tidePhase = '';
      for (let i = 0; i < tideData.length - 1; i++) {
        const currentTide = tideData[i];
        const nextTide = tideData[i + 1];
        
        if (currentTimeStr >= currentTide.time && currentTimeStr < nextTide.time) {
          if (currentTide.type.toLowerCase() === 'low') {
            tidePhase = `Tide is coming in`;
          } else {
            tidePhase = `Tide is going out`;
          }
          break;
        }
      }
      
      if (tidePhase) {
        report += `${tidePhase}. `;
      }
      
      const tideList = tideData.map(t => {
        const height = parseNumericValue(t.height, 0);
        return `${t.type} ${t.time} (${height.toFixed(1)}ft)`;
      }).join(', ');
      
      report += `Today's tides: ${tideList}.`;
      
      // Tide advice
      if (waveHeight >= 4) {
        report += ` Mid to high tide will be best for this size.`;
      } else if (waveHeight >= 2) {
        report += ` Mid tide usually works best.`;
      } else {
        report += ` Low to mid tide might give you the best shot.`;
      }
    }

    // RECOMMENDATION - Clear and actionable
    report += '\n\n';
    
    if (rating >= 8) {
      const recs = [
        `Get out there! This is what you've been waiting for.`,
        `Drop everything - these conditions are prime.`,
        `Don't miss this one. Everything is lining up.`,
      ];
      report += recs[seed % recs.length];
    } else if (rating >= 6) {
      const recs = [
        `Worth the paddle out. Should be a fun session.`,
        `Definitely surf-worthy if you've got time.`,
        `Good enough to make it worth your while.`,
      ];
      report += recs[seed % recs.length];
    } else if (rating >= 4) {
      const recs = [
        `Decent for beginners or longboarders. Mellow session vibes.`,
        `Small but rideable. Good for working on technique.`,
        `Not epic but you can catch waves. Perfect for learning.`,
      ];
      report += recs[seed % recs.length];
    } else {
      const recs = [
        `Save your energy for a better swell. Not much out there today.`,
        `Probably not worth it. Wait for conditions to improve.`,
        `Pretty minimal. Check back tomorrow or later this week.`,
      ];
      report += recs[seed % recs.length];
    }

    console.log('[generateReportText] ✅ Report complete for', personality.nickname);
    console.log('[generateReportText] 📏 Total length:', report.length, 'characters');
    console.log('[generateReportText] 🔍 Location check:', report.includes(personality.nickname) ? '✅ CORRECT' : '❌ WRONG');

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
    
    let locationId = 'folly-beach';
    try {
      const body = await req.json();
      if (body.location) {
        locationId = body.location;
        console.log('Location parameter received:', locationId);
      }
    } catch (e) {
      console.log('No location parameter in request body, using default: folly-beach');
    }

    const personality = getLocationPersonality(locationId);
    console.log('Generating report for:', personality.nickname, '(ID:', locationId, ')');
    
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

    // 🚨 CRITICAL: Ensure location field is set correctly in surfData
    if (!surfData.location || surfData.location !== locationId) {
      console.log(`[${personality.nickname}] ⚠️ Correcting location field from "${surfData.location}" to "${locationId}"`);
      surfData.location = locationId;
    }

    const hasValidWaveData = surfData.wave_height !== 'N/A' || surfData.surf_height !== 'N/A';
    
    if (!hasValidWaveData) {
      console.log(`[${personality.nickname}] ⚠️ No valid wave data, generating fallback narrative`);
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
        conditions: generateNoWaveDataReportText(weatherData, surfData, tideData, locationId),
        rating: 0,
        updated_at: new Date().toISOString(),
      };

      const { error: deleteError } = await supabase
        .from('surf_reports')
        .delete()
        .eq('date', today)
        .eq('location', locationId);

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
      console.log('Location used:', personality.nickname);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Daily surf report generated for ${personality.nickname} (wave sensors offline)`,
          location: personality.nickname,
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

    const tideSummary = generateTideSummary(tideData);
    const rating = calculateSurfRating(surfData, weatherData);
    const reportText = generateReportText(surfData, weatherData, tideSummary, rating, historicalDataDate, tideData);

    console.log('[generate-daily-report] ✅ Report text generated');
    console.log('[generate-daily-report] 📏 Length:', reportText.length, 'characters');
    console.log('[generate-daily-report] 🔍 Location check:', reportText.includes(personality.nickname) ? '✅ CORRECT' : '❌ WRONG');

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

    const { error: deleteError } = await supabase
      .from('surf_reports')
      .delete()
      .eq('date', today)
      .eq('location', locationId);

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
    console.log('Location used:', personality.nickname);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily surf report generated successfully for ${personality.nickname}`,
        location: personality.nickname,
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
