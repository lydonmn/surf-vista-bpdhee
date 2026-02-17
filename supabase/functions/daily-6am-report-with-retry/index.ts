
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Location-specific personality traits - UPDATED WITH ALL CURRENT LOCATIONS INCLUDING JUPITER
const LOCATION_PERSONALITIES: Record<string, {
  casual: string[];
  excited: string[];
  disappointed: string[];
  nickname: string;
  fullName: string;
}> = {
  'folly-beach': {
    casual: ['Folly', 'the Edge of America', 'Folly Beach'],
    excited: ['Folly is firing', 'Folly is going off', 'Folly is pumping'],
    disappointed: ['not much happening at Folly', 'Folly is pretty flat', 'Folly is taking a rest'],
    nickname: 'Folly Beach',
    fullName: 'Folly Beach, South Carolina'
  },
  'pawleys-island': {
    casual: ['Pawleys', 'the island', 'Pawleys Island'],
    excited: ['Pawleys has swell', 'Pawleys is working', 'Pawleys is delivering'],
    disappointed: ['not a wave on Pawleys', 'Pawleys is dead flat', 'Pawleys is sleeping'],
    nickname: 'Pawleys Island',
    fullName: 'Pawleys Island, South Carolina'
  },
  'holden-beach-nc': {
    casual: ['Holden', 'Holden Beach', 'the beach'],
    excited: ['Holden is cranking', 'Holden has waves', 'Holden is alive'],
    disappointed: ['Holden is flat', 'nothing at Holden', 'Holden is quiet'],
    nickname: 'Holden Beach',
    fullName: 'Holden Beach, North Carolina'
  },
  'rexhame-beach,-massachusetts-': {
    casual: ['Marshfield', 'Rexhame Beach', 'the beach'],
    excited: ['Marshfield is firing', 'Marshfield has swell', 'Marshfield is pumping'],
    disappointed: ['not much at Marshfield', 'Marshfield is flat', 'Marshfield is quiet'],
    nickname: 'Marshfield',
    fullName: 'Marshfield, Massachusetts'
  },
  'marshfield-ma': {
    casual: ['Marshfield', 'Rexhame Beach', 'the beach'],
    excited: ['Marshfield is firing', 'Marshfield has swell', 'Marshfield is pumping'],
    disappointed: ['not much at Marshfield', 'Marshfield is flat', 'Marshfield is quiet'],
    nickname: 'Marshfield',
    fullName: 'Marshfield, Massachusetts'
  },
  'cisco-beach': {
    casual: ['Cisco', 'Cisco Beach', 'the beach'],
    excited: ['Cisco is firing', 'Cisco has swell', 'Cisco is pumping'],
    disappointed: ['not much at Cisco', 'Cisco is flat', 'Cisco is quiet'],
    nickname: 'Cisco Beach',
    fullName: 'Cisco Beach, Nantucket'
  },
  'cisco-beach-nantucket': {
    casual: ['Cisco', 'Cisco Beach', 'the beach'],
    excited: ['Cisco is firing', 'Cisco has swell', 'Cisco is pumping'],
    disappointed: ['not much at Cisco', 'Cisco is flat', 'Cisco is quiet'],
    nickname: 'Cisco Beach',
    fullName: 'Cisco Beach, Nantucket'
  },
  // 🚨 CRITICAL FIX: Added Jupiter location personality
  'jupiter-florida': {
    casual: ['Jupiter', 'Jupiter Inlet', 'the inlet'],
    excited: ['Jupiter is firing', 'Jupiter has swell', 'Jupiter is pumping'],
    disappointed: ['not much at Jupiter', 'Jupiter is flat', 'Jupiter is quiet'],
    nickname: 'Jupiter Inlet',
    fullName: 'Jupiter Inlet, Florida'
  },
  'jupiter-inlet': {
    casual: ['Jupiter', 'Jupiter Inlet', 'the inlet'],
    excited: ['Jupiter is firing', 'Jupiter has swell', 'Jupiter is pumping'],
    disappointed: ['not much at Jupiter', 'Jupiter is flat', 'Jupiter is quiet'],
    nickname: 'Jupiter Inlet',
    fullName: 'Jupiter Inlet, Florida'
  },
  'jupiter': {
    casual: ['Jupiter', 'Jupiter Inlet', 'the inlet'],
    excited: ['Jupiter is firing', 'Jupiter has swell', 'Jupiter is pumping'],
    disappointed: ['not much at Jupiter', 'Jupiter is flat', 'Jupiter is quiet'],
    nickname: 'Jupiter Inlet',
    fullName: 'Jupiter Inlet, Florida'
  }
};

function getLocationPersonality(locationId: string) {
  console.log('[getLocationPersonality] Looking up personality for:', locationId);
  const personality = LOCATION_PERSONALITIES[locationId] || {
    casual: [locationId.replace(/-/g, ' ')],
    excited: [`${locationId.replace(/-/g, ' ')} is firing`],
    disappointed: [`not much at ${locationId.replace(/-/g, ' ')}`],
    nickname: locationId.replace(/-/g, ' '),
    fullName: locationId.replace(/-/g, ' ')
  };
  console.log('[getLocationPersonality] Using personality for:', personality.nickname);
  return personality;
}

function parseNumericValue(value: string | null | undefined, defaultValue: number = 0): number {
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  const match = value.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

function formatSwellDirection(direction: string | null | undefined): string {
  if (!direction) return 'mixed';
  
  const cleaned = direction.replace(/[0-9°\s]+/g, '').trim();
  const normalized = cleaned.toUpperCase();
  
  const directionMap: Record<string, string> = {
    'N': 'N',
    'NORTH': 'N',
    'NE': 'NE',
    'NORTHEAST': 'NE',
    'E': 'E',
    'EAST': 'E',
    'SE': 'SE',
    'SOUTHEAST': 'SE',
    'S': 'S',
    'SOUTH': 'S',
    'SW': 'SW',
    'SOUTHWEST': 'SW',
    'W': 'W',
    'WEST': 'W',
    'NW': 'NW',
    'NORTHWEST': 'NW',
  };
  
  return directionMap[normalized] || cleaned || 'mixed';
}

function selectRandom<T>(array: T[]): T {
  const index = Math.floor((Date.now() + Math.random() * 1000) / 100) % array.length;
  return array[index];
}

function generateNoWaveDataReportText(weatherData: any, surfData: any, locationId: string): string {
  const personality = getLocationPersonality(locationId);
  console.log('[generateNoWaveDataReportText] 🏖️ Generating for location:', personality.nickname);
  
  const windSpeed = parseNumericValue(surfData.wind_speed, 0);
  const windDirRaw = surfData.wind_direction || 'variable';
  const windDir = windDirRaw
    .replace(/feet/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
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
  
  return selectedMessage;
}

// 🚨 ENHANCED NARRATIVE GENERATOR: 300-500 characters, focused on surf height and rideability
// ✅ MIRRORS ALL IMPROVEMENTS: detailed descriptions, proper formatting, no redundant metrics
function generateWittyNarrative(
  surfConditions: any, 
  captureTime: string, 
  date: string,
  weatherData: any = null,
  locationIdOverride: string | null = null
): string {
  console.log('[generateWittyNarrative] ═════════════════════════════════════════');
  console.log('[generateWittyNarrative] 🎯 STARTING ENHANCED NARRATIVE GENERATION');
  console.log('[generateWittyNarrative] ═════════════════════════════════════════');
  
  // 🚨 CRITICAL FIX: ALWAYS use locationIdOverride if provided, NEVER fall back to surfConditions.location
  // The surfConditions.location field may be stale or incorrect from database
  const locationId = locationIdOverride || surfConditions.location || 'folly-beach';
  
  console.log('[generateWittyNarrative] 🎯 LOCATION RESOLUTION:');
  console.log('[generateWittyNarrative]   locationIdOverride (from function call):', locationIdOverride);
  console.log('[generateWittyNarrative]   surfConditions.location (from data):', surfConditions.location);
  console.log('[generateWittyNarrative]   ✅ FINAL locationId being used:', locationId);
  
  // 🚨 CRITICAL: Get personality IMMEDIATELY after determining locationId
  const personality = getLocationPersonality(locationId);
  console.log('[generateWittyNarrative] 🏖️ Using personality for:', personality.nickname);
  console.log('[generateWittyNarrative] 🏖️ Personality casual options:', personality.casual);
  console.log('[generateWittyNarrative] 🏖️ Personality excited options:', personality.excited);
  console.log('[generateWittyNarrative] 🏖️ Personality disappointed options:', personality.disappointed);
  
  console.log('[generateWittyNarrative] surf_height:', surfConditions.surf_height);
  console.log('[generateWittyNarrative] wave_height:', surfConditions.wave_height);
  console.log('[generateWittyNarrative] wind_speed:', surfConditions.wind_speed);
  console.log('[generateWittyNarrative] wind_direction:', surfConditions.wind_direction);
  console.log('[generateWittyNarrative] water_temp:', surfConditions.water_temp);
  console.log('[generateWittyNarrative] wave_period:', surfConditions.wave_period);
  
  const rideableFaceStr = surfConditions.surf_height || surfConditions.wave_height;
  
  console.log('[generateWittyNarrative] Rideable face string:', rideableFaceStr);
  
  const waveSensorsOffline = !rideableFaceStr || rideableFaceStr === 'N/A' || rideableFaceStr === '';
  
  if (waveSensorsOffline) {
    console.log('[generateWittyNarrative] ⚠️ Wave sensors offline - generating fallback narrative');
    const fallbackNarrative = generateNoWaveDataReportText(weatherData, surfConditions, locationId);
    console.log('[generateWittyNarrative] ✅ Fallback narrative generated:', fallbackNarrative.length, 'characters');
    console.log('[generateWittyNarrative] 🏖️ Fallback narrative location check:', fallbackNarrative.includes(personality.nickname) ? '✅ CORRECT' : '❌ WRONG');
    return fallbackNarrative;
  }
  
  // Parse the surf height value (handle ranges like "2.5-3.5 ft")
  let waveHeight = 0;
  let waveHeightLow = 0;
  let waveHeightHigh = 0;
  const cleanedStr = String(rideableFaceStr).trim();
  
  console.log('[generateWittyNarrative] Parsing wave height from:', cleanedStr);
  
  if (cleanedStr.includes('-')) {
    const parts = cleanedStr.split('-');
    waveHeightLow = parseNumericValue(parts[0], 0);
    waveHeightHigh = parseNumericValue(parts[1], 0);
    waveHeight = (waveHeightLow + waveHeightHigh) / 2;
    console.log('[generateWittyNarrative] ✅ Parsed range:', { low: waveHeightLow, high: waveHeightHigh, average: waveHeight });
  } else {
    waveHeight = parseNumericValue(rideableFaceStr, 0);
    waveHeightLow = waveHeight;
    waveHeightHigh = waveHeight;
    console.log('[generateWittyNarrative] ✅ Parsed single value:', waveHeight);
  }
  
  if (waveHeight <= 0 || isNaN(waveHeight)) {
    console.error('[generateWittyNarrative] ❌ Invalid wave height after parsing:', waveHeight);
    console.error('[generateWittyNarrative] ❌ Falling back to no-wave-data narrative');
    return generateNoWaveDataReportText(weatherData, surfConditions, locationId);
  }
  
  console.log('[generateWittyNarrative] ✅ Valid wave height:', waveHeight, 'feet');
  
  const windSpeed = parseNumericValue(surfConditions.wind_speed, 0);
  const windDirRaw = surfConditions.wind_direction || 'variable';
  const windDir = windDirRaw
    .replace(/feet/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  const swellDir = formatSwellDirection(surfConditions.swell_direction);
  const period = parseNumericValue(surfConditions.wave_period, 0);
  const waterTemp = parseNumericValue(surfConditions.water_temp, 0);
  const airTemp = parseNumericValue(weatherData?.temperature, 0);
  const weatherConditions = weatherData?.conditions || weatherData?.short_forecast || 'partly cloudy';

  console.log('[generateWittyNarrative] 📊 Parsed values:', {
    waveHeight,
    waveHeightLow,
    waveHeightHigh,
    windSpeed,
    windDir,
    swellDir,
    period,
    waterTemp,
    airTemp,
  });

  const isOffshore = windDir.toLowerCase().includes('w') || windDir.toLowerCase().includes('n');
  const rating = calculateSurfRating(surfConditions);
  
  // 🚨 CRITICAL: Create seed based on locationId to ensure consistent randomization per location per day
  const seed = locationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Date.now() / 86400000);

  console.log('[generateWittyNarrative] 🎲 Seed for randomization:', seed);
  console.log('[generateWittyNarrative] 🌬️ Wind offshore:', isOffshore);
  console.log('[generateWittyNarrative] ⭐ Rating:', rating);

  let report = '';

  // 🎯 OPENING: Set expectations based on surf height and quality
  // 🚨 CRITICAL: ALL openings now use personality.nickname to ensure correct location
  console.log('[generateWittyNarrative] 📝 Building opening for:', personality.nickname);
  if (waveHeight >= 8) {
    const openings = [
      `${personality.nickname} is absolutely firing today with overhead sets`,
      `Epic conditions at ${personality.nickname} - we're seeing serious size`,
      `${personality.nickname} is going off with well overhead waves`,
    ];
    report += openings[seed % openings.length];
  } else if (waveHeight >= 5) {
    const openings = [
      `${personality.nickname} has solid head-high surf rolling through`,
      `Looking really good at ${personality.nickname} with overhead waves`,
      `${personality.nickname} is delivering quality head-high sets`,
    ];
    report += openings[seed % openings.length];
  } else if (waveHeight >= 3) {
    const openings = [
      `${personality.nickname} has fun chest to shoulder high waves`,
      `Decent session potential at ${personality.nickname} with chest-high surf`,
      `${personality.nickname} is serving up chest-high waves`,
    ];
    report += openings[seed % openings.length];
  } else if (waveHeight >= 1.5) {
    const openings = [
      `${personality.nickname} has small but rideable waist-high surf`,
      `Mellow conditions at ${personality.nickname} with waist-high waves`,
      `${personality.nickname} is offering beginner-friendly waist-high surf`,
    ];
    report += openings[seed % openings.length];
  } else {
    const openings = [
      `${personality.nickname} is pretty flat today with minimal surf`,
      `Not much happening at ${personality.nickname} - ankle-high at best`,
      `${personality.nickname} is taking a rest with barely rideable waves`,
    ];
    report += openings[seed % openings.length];
  }

  report += '.\n\n';
  console.log('[generateWittyNarrative] ✅ Opening added (location:', personality.nickname, '):', report.substring(0, 100));

  // 🌊 WAVE DETAIL: Describe the surf height range and what it means for riding
  console.log('[generateWittyNarrative] 📝 Building wave detail...');
  if (waveHeightLow !== waveHeightHigh) {
    report += `Faces are running ${waveHeightLow.toFixed(1)} feet to ${waveHeightHigh.toFixed(1)} feet`;
  } else {
    report += `Faces are around ${waveHeight.toFixed(1)} feet`;
  }
  
  // Add context about rideability based on size
  if (waveHeight >= 8) {
    report += `, which is serious size for experienced surfers only. These waves have real power and consequence`;
  } else if (waveHeight >= 5) {
    report += `, perfect for intermediate to advanced surfers looking for a solid session. Plenty of face to work with`;
  } else if (waveHeight >= 3) {
    report += `, ideal for most skill levels. Enough push to have fun without being overwhelming`;
  } else if (waveHeight >= 1.5) {
    report += `, great for beginners and longboarders. Mellow enough to practice fundamentals`;
  } else {
    report += `, barely enough to ride. You'll need a longboard or foamie to catch anything`;
  }
  
  report += '.\n\n';
  console.log('[generateWittyNarrative] ✅ Wave detail added:', report.length, 'chars');

  // 📊 PERIOD & SWELL: How the energy translates to ride quality
  console.log('[generateWittyNarrative] 📝 Building period/swell detail...');
  if (period >= 12) {
    report += `${period.toFixed(0)}-second period from the ${swellDir} brings long-interval groundswell with powerful, well-spaced sets`;
  } else if (period >= 10) {
    report += `${period.toFixed(0)}-second period from the ${swellDir} brings decent energy with well-spaced sets that give you time to position`;
  } else if (period >= 8) {
    report += `${period.toFixed(0)}-second period from the ${swellDir} provides moderate power, though waves come in more frequently`;
  } else if (period >= 6) {
    report += `Shorter ${period.toFixed(0)}-second period from the ${swellDir} means weaker, more frequent waves without much push`;
  } else if (period > 0) {
    report += `Quick ${period.toFixed(0)}-second period indicates choppy wind swell from the ${swellDir} with limited power`;
  } else {
    console.warn('[generateWittyNarrative] ⚠️ No period data available, skipping period section');
  }
  
  if (period > 0) {
    report += '.\n\n';
    console.log('[generateWittyNarrative] ✅ Period detail added:', report.length, 'chars');
  }

  // 💨 WIND: How it affects the wave faces and ride quality
  console.log('[generateWittyNarrative] 📝 Building wind detail...');
  if (windSpeed > 0) {
    if (isOffshore) {
      if (windSpeed < 5) {
        report += `Light ${windSpeed.toFixed(0)} mph ${windDir} offshore breeze is grooming the faces into glassy perfection`;
      } else if (windSpeed < 10) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} offshore wind is holding up the wave faces and creating clean barrels`;
      } else if (windSpeed < 15) {
        report += `Strong ${windSpeed.toFixed(0)} mph ${windDir} offshore is making it challenging to paddle out but the faces are pristine`;
      } else {
        report += `Howling ${windSpeed.toFixed(0)} mph ${windDir} offshore is blowing spray off the tops and making it difficult to get outside`;
      }
    } else {
      if (windSpeed < 5) {
        report += `Calm ${windSpeed.toFixed(0)} mph ${windDir} wind means minimal texture on the faces`;
      } else if (windSpeed < 10) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} onshore is adding some chop but waves are still rideable`;
      } else if (windSpeed < 15) {
        report += `${windSpeed.toFixed(0)} mph ${windDir} onshore is creating bumpy, choppy conditions that make it harder to ride`;
      } else {
        report += `Strong ${windSpeed.toFixed(0)} mph ${windDir} onshore has blown it out - waves are messy and crumbly`;
      }
    }
    
    report += '.\n\n';
    console.log('[generateWittyNarrative] ✅ Wind detail added:', report.length, 'chars');
  } else {
    console.warn('[generateWittyNarrative] ⚠️ No wind data available, skipping wind section');
  }

  // 🌡️ WATER TEMP & WEATHER: Brief conditions without redundancy
  console.log('[generateWittyNarrative] 📝 Building water temp/weather detail...');
  if (waterTemp > 0) {
    report += `Water is ${waterTemp.toFixed(0)}°F`;
    
    if (waterTemp >= 75) {
      report += ` - boardshorts weather`;
    } else if (waterTemp >= 68) {
      report += ` - spring suit recommended`;
    } else if (waterTemp >= 60) {
      report += ` - 3/2mm wetsuit territory`;
    } else if (waterTemp >= 50) {
      report += ` - 4/3mm with booties needed`;
    } else {
      report += ` - 5/4mm with hood and gloves`;
    }
  }
  
  if (airTemp > 0 && weatherConditions) {
    report += `. ${airTemp.toFixed(0)}°F air with ${weatherConditions.toLowerCase()}`;
  } else if (weatherConditions) {
    report += `. ${weatherConditions}`;
  }
  
  report += '.\n\n';
  console.log('[generateWittyNarrative] ✅ Water temp/weather added:', report.length, 'chars');

  // 🏄 FINAL CALL: Action recommendation based on overall quality
  console.log('[generateWittyNarrative] 📝 Building final call...');
  if (rating >= 8 && waveHeight >= 5) {
    const recs = [
      `Drop everything and get out there - these are the conditions you've been waiting for`,
      `This is a must-surf session. Everything is lining up perfectly`,
      `Don't miss this one. Premium conditions that don't come around often`,
    ];
    report += recs[seed % recs.length];
  } else if (rating >= 7 && waveHeight >= 3) {
    const recs = [
      `Definitely worth the paddle out. Should be a really fun session`,
      `Get on it if you can - solid conditions for a quality surf`,
      `This is surf-worthy for sure. Good size with clean conditions`,
    ];
    report += recs[seed % recs.length];
  } else if (rating >= 5 && waveHeight >= 2) {
    const recs = [
      `Worth checking out if you're nearby. Decent waves for a casual session`,
      `Not epic but definitely rideable. Good for working on your technique`,
      `Surf-able conditions. Won't blow your mind but you'll catch waves`,
    ];
    report += recs[seed % recs.length];
  } else if (waveHeight >= 1) {
    const recs = [
      `Small but rideable for longboarders and beginners. Mellow vibes`,
      `Perfect for learning or cruising on a longboard. Low-pressure session`,
      `Beginner-friendly conditions. Great for practicing fundamentals`,
    ];
    report += recs[seed % recs.length];
  } else {
    const recs = [
      `Save your energy for a better swell. Not much out there today`,
      `Pretty minimal. Check back tomorrow when conditions improve`,
      `Not worth the paddle. Wait for the next swell to fill in`,
    ];
    report += recs[seed % recs.length];
  }

  report += '.';

  console.log('[generateWittyNarrative] ═════════════════════════════════════════');
  console.log('[generateWittyNarrative] ✅ ENHANCED NARRATIVE COMPLETE');
  console.log('[generateWittyNarrative] 🏖️ Location used:', personality.nickname);
  console.log('[generateWittyNarrative] 📏 Total length:', report.length, 'characters');
  console.log('[generateWittyNarrative] 📄 Preview:', report.substring(0, 150));
  console.log('[generateWittyNarrative] 🔍 Contains \\n\\n:', report.includes('\n\n'));
  console.log('[generateWittyNarrative] 🔍 Newline count:', (report.match(/\n\n/g) || []).length);
  console.log('[generateWittyNarrative] 🔍 Location check:', report.includes(personality.nickname) ? '✅ CORRECT' : '❌ WRONG');
  
  // 🚨 CRITICAL VERIFICATION: If the narrative doesn't contain the correct location, log a critical error
  if (!report.includes(personality.nickname)) {
    console.error('[generateWittyNarrative] ❌❌❌ CRITICAL ERROR: Generated narrative does NOT contain correct location!');
    console.error('[generateWittyNarrative] ❌ Expected location:', personality.nickname);
    console.error('[generateWittyNarrative] ❌ LocationId used:', locationId);
    console.error('[generateWittyNarrative] ❌ Full narrative:', report);
  }
  
  console.log('[generateWittyNarrative] ═════════════════════════════════════════');

  return report;
}

function calculateSurfRating(surfConditions: any): number {
  try {
    const surfHeightStr = surfConditions.surf_height || surfConditions.wave_height || '0';
    const periodStr = surfConditions.wave_period || '0';
    const windSpeedStr = surfConditions.wind_speed || '0';
    
    console.log('[calculateSurfRating] Input:', { surfHeightStr, periodStr, windSpeedStr });
    
    if (surfHeightStr === 'N/A' || surfHeightStr === '') {
      console.log('[calculateSurfRating] Wave sensors offline - returning neutral rating of 5');
      return 5;
    }
    
    let surfHeight = 0;
    const cleanedStr = String(surfHeightStr).trim();
    
    if (cleanedStr.includes('-')) {
      const parts = cleanedStr.split('-');
      const low = parseNumericValue(parts[0], 0);
      const high = parseNumericValue(parts[1], 0);
      surfHeight = (low + high) / 2;
      console.log('[calculateSurfRating] Parsed range:', { low, high, average: surfHeight });
    } else {
      surfHeight = parseNumericValue(surfHeightStr, 0);
      console.log('[calculateSurfRating] Parsed single value:', surfHeight);
    }
    
    const period = parseNumericValue(periodStr, 0);
    const windSpeed = parseNumericValue(windSpeedStr, 0);

    let rating = 3;

    if (surfHeight >= 6) rating += 5;
    else if (surfHeight >= 4) rating += 4;
    else if (surfHeight >= 3) rating += 3;
    else if (surfHeight >= 2) rating += 2;
    else if (surfHeight >= 1) rating += 1;
    else if (surfHeight < 1) rating -= 1;

    if (period >= 12) rating += 3;
    else if (period >= 10) rating += 2;
    else if (period >= 8) rating += 1;
    else if (period < 6 && period > 0) rating -= 1;

    if (windSpeed < 5) rating += 1;
    else if (windSpeed > 15) rating -= 2;

    const finalRating = Math.max(1, Math.min(10, Math.round(rating)));
    console.log(`[calculateSurfRating] ✅ Final rating: ${finalRating}/10 (surf_height=${surfHeight}ft, period=${period}s, wind=${windSpeed}mph)`);
    
    return finalRating;
  } catch (error) {
    console.error('[calculateSurfRating] ❌ Error calculating rating:', error);
    return 5;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetLocationId: string | null = null;
    let isManualTrigger = false;
    
    try {
      const body = await req.json();
      if (body.location) {
        targetLocationId = body.location;
        isManualTrigger = body.isManualTrigger === true;
        console.log('[Daily 6AM Report] Manual trigger mode - target:', targetLocationId, 'isManualTrigger:', isManualTrigger);
      }
    } catch (e) {
      console.log('[Daily 6AM Report] Scheduled mode - processing all locations');
    }

    console.log('[Daily 6AM Report] ═════════════════════════════════════════');
    console.log('[Daily 6AM Report] 🌅 REPORT GENERATION STARTED');
    console.log(`[Daily 6AM Report] Mode: ${isManualTrigger ? 'MANUAL TRIGGER (use existing data)' : 'SCHEDULED 6AM RUN (fetch fresh data)'}`);
    console.log('[Daily 6AM Report] ═════════════════════════════════════════');

    // ✅ DYNAMIC LOCATION FETCHING: Automatically includes all active locations from database
    let locationsQuery = supabase
      .from('locations')
      .select('id, name, display_name')
      .eq('is_active', true);
    
    if (targetLocationId) {
      locationsQuery = locationsQuery.eq('id', targetLocationId);
    }
    
    const { data: locationsData, error: locationsError } = await locationsQuery.order('name');

    if (locationsError) {
      console.error('[Daily 6AM Report] Error fetching locations:', locationsError);
      throw new Error(`Failed to fetch locations: ${locationsError.message}`);
    }

    if (!locationsData || locationsData.length === 0) {
      const errorMsg = targetLocationId 
        ? `Location '${targetLocationId}' not found or inactive`
        : 'No active locations found in database';
      console.warn('[Daily 6AM Report]', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const modeText = targetLocationId ? 'single location' : `${locationsData.length} location(s)`;
    console.log(`[Daily 6AM Report] ✅ Processing ${modeText}:`, locationsData.map(l => l.display_name).join(', '));

    const now = new Date();
    const estDateString = now.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const [month, day, year] = estDateString.split('/');
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    console.log('[Daily 6AM Report] 📅 Target date (YYYY-MM-DD):', dateStr);

    const results = [];
    
    for (const location of locationsData) {
      console.log(`\n[Daily 6AM Report] ═════════════════════════════════════════`);
      console.log(`[Daily 6AM Report] 📍 Processing ${location.display_name}...`);
      console.log(`[Daily 6AM Report] 🆔 Location ID: ${location.id}`);
      console.log(`[Daily 6AM Report] ═════════════════════════════════════════`);
      
      const result = await processLocation(supabase, location.id, location.display_name, dateStr, isManualTrigger);
      results.push(result);
      
      if (result.success) {
        console.log(`[Daily 6AM Report] ✅ ${location.display_name}: SUCCESS`);
        
        if (!result.skipped && !isManualTrigger) {
          console.log(`[Daily 6AM Report] ═════════════════════════════════════════`);
          console.log(`[Daily 6AM Report] 📢 PUSH NOTIFICATION PHASE`);
          console.log(`[Daily 6AM Report] 📢 Sending notifications for ${location.display_name}...`);
          console.log(`[Daily 6AM Report] ═════════════════════════════════════════`);
          
          try {
            const notificationResult = await supabase.functions.invoke('send-daily-report-notifications', {
              body: { 
                location: location.id,
                date: dateStr,
              },
            });

            if (notificationResult.data?.success) {
              console.log(`[Daily 6AM Report] ✅ PUSH NOTIFICATIONS SENT SUCCESSFULLY`);
              console.log(`[Daily 6AM Report]    • Location: ${location.display_name}`);
              console.log(`[Daily 6AM Report]    • Date: ${dateStr}`);
              console.log(`[Daily 6AM Report]    • Users notified: ${notificationResult.data.notificationsSent}`);
              console.log(`[Daily 6AM Report]    • Total opted-in: ${notificationResult.data.totalOptedIn}`);
              console.log(`[Daily 6AM Report]    • Eligible users: ${notificationResult.data.eligibleUsers}`);
              console.log(`[Daily 6AM Report]    • Users without tokens: ${notificationResult.data.usersWithoutValidTokens}`);
              
              if (notificationResult.data.notificationsFailed > 0) {
                console.warn(`[Daily 6AM Report] ⚠️ Some notifications failed: ${notificationResult.data.notificationsFailed}`);
                if (notificationResult.data.failedUsers && notificationResult.data.failedUsers.length > 0) {
                  console.warn(`[Daily 6AM Report] Failed users:`, notificationResult.data.failedUsers);
                }
              }
            } else {
              console.warn(`[Daily 6AM Report] ⚠️ Notification send failed:`, notificationResult.error);
              console.warn(`[Daily 6AM Report] ⚠️ Report was generated but notifications were not sent`);
            }
          } catch (notifError) {
            console.error(`[Daily 6AM Report] ❌ Notification error:`, notifError);
            console.error(`[Daily 6AM Report] ❌ Report was generated but notifications failed`);
          }
          
          console.log(`[Daily 6AM Report] ═════════════════════════════════════════`);
        } else if (isManualTrigger) {
          console.log(`[Daily 6AM Report] ℹ️ Skipping notifications (manual trigger from admin panel)`);
        } else if (result.skipped) {
          console.log(`[Daily 6AM Report] ℹ️ Skipping notifications (report already existed)`);
        }
      } else {
        console.log(`[Daily 6AM Report] ❌ ${location.display_name}: FAILED - ${result.error}`);
      }
    }

    const allSucceeded = results.every(r => r.success);
    const someSucceeded = results.some(r => r.success);

    console.log('\n[Daily 6AM Report] ═════════════════════════════════════════');
    console.log('[Daily 6AM Report] 📊 FINAL RESULTS:');
    console.log(`[Daily 6AM Report] Total locations: ${results.length}`);
    console.log(`[Daily 6AM Report] Successful: ${results.filter(r => r.success).length}`);
    console.log(`[Daily 6AM Report] Failed: ${results.filter(r => !r.success).length}`);
    console.log('[Daily 6AM Report] ═════════════════════════════════════════');

    if (allSucceeded) {
      const message = targetLocationId 
        ? `Report generated successfully for ${locationsData[0].display_name}`
        : 'Daily reports generated and notifications sent successfully for all locations';
      return new Response(
        JSON.stringify({
          success: true,
          message: message,
          date: dateStr,
          results: results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (someSucceeded) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Partial success - some locations failed',
          date: dateStr,
          results: results,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'All locations failed to generate reports',
          date: dateStr,
          results: results,
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error: any) {
    console.error('[Daily 6AM Report] 💥 Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processLocation(
  supabase: any, 
  locationId: string, 
  locationName: string, 
  dateStr: string,
  isManualTrigger: boolean = false
) {
  const MAX_RETRIES = isManualTrigger ? 1 : 10;
  const RETRY_DELAYS = [5000, 10000, 20000, 30000, 60000, 120000, 180000, 300000, 600000, 900000];
  
  try {
    console.log(`[${locationName}] ═════════════════════════════════════════`);
    console.log(`[${locationName}] 🔍 CHECKING EXISTING REPORT`);
    console.log(`[${locationName}] Date: ${dateStr}`);
    console.log(`[${locationName}] Location: ${locationId}`);
    console.log(`[${locationName}] Manual trigger: ${isManualTrigger}`);
    console.log(`[${locationName}] ═════════════════════════════════════════`);
    
    const { data: existingReport } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();

    if (existingReport) {
      console.log(`[${locationName}] ✅ Found existing report`);
      console.log(`[${locationName}] 📊 conditions length: ${existingReport.conditions?.length || 0}`);
      console.log(`[${locationName}] 📊 report_text length: ${existingReport.report_text?.length || 0}`);
      console.log(`[${locationName}] 📊 Manual trigger: ${isManualTrigger}`);
    }

    if (existingReport && existingReport.conditions && existingReport.conditions.length > 100 && !isManualTrigger) {
      console.log(`[${locationName}] ✅ Valid report already exists for today - skipping (scheduled mode)`);
      return {
        success: true,
        location: locationName,
        locationId: locationId,
        message: 'Report already exists',
        skipped: true,
      };
    }

    if (isManualTrigger) {
      console.log(`[${locationName}] 🔄 Manual trigger: Will regenerate narrative even if report exists`);
    }

    console.log(`[${locationName}] 📝 Generating ${isManualTrigger ? 'updated' : 'new'} report for ${dateStr}...`);

    let weatherData = null;
    
    if (isManualTrigger) {
      console.log(`[${locationName}] 🔍 Manual trigger: Fetching existing weather data from database...`);
      
      const { data: weatherDbData, error: weatherDbError } = await supabase
        .from('weather_data')
        .select('*')
        .eq('location', locationId)
        .gte('date', dateStr)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (weatherDbError) {
        console.warn(`[${locationName}] ⚠️ Error fetching weather data:`, weatherDbError);
      } else if (weatherDbData) {
        console.log(`[${locationName}] ✅ Found weather data in database (date: ${weatherDbData.date})`);
        weatherData = weatherDbData;
      } else {
        console.log(`[${locationName}] ⚠️ No weather data found, will use defaults`);
      }
    } else {
      console.log(`[${locationName}] Step 1: Fetching weather data...`);
      for (let weatherAttempt = 1; weatherAttempt <= 3; weatherAttempt++) {
        try {
          const { data: weatherResult, error: weatherError } = await supabase.functions.invoke('fetch-weather-data', {
            body: { location: locationId },
          });

          if (weatherError) {
            console.warn(`[${locationName}] Weather fetch attempt ${weatherAttempt} warning:`, weatherError);
          } else if (weatherResult?.success) {
            console.log(`[${locationName}] ✅ Weather data fetched on attempt ${weatherAttempt}`);
            
            await delay(1000);
            
            const { data: weatherDbData } = await supabase
              .from('weather_data')
              .select('*')
              .eq('date', dateStr)
              .eq('location', locationId)
              .maybeSingle();
            
            if (weatherDbData) {
              weatherData = weatherDbData;
              break;
            }
          }
          
          if (weatherAttempt < 3) {
            await delay(2000);
          }
        } catch (weatherError: any) {
          console.warn(`[${locationName}] Weather fetch attempt ${weatherAttempt} failed:`, weatherError);
        }
      }
    }

    let surfConditions = null;
    let usedFallbackData = false;
    
    console.log(`[${locationName}] ═════════════════════════════════════════`);
    console.log(`[${locationName}] 🌊 FETCHING SURF/BUOY DATA`);
    console.log(`[${locationName}] Mode: ${isManualTrigger ? 'MANUAL (use most recent available data)' : 'SCHEDULED (retry for fresh data)'}`);
    console.log(`[${locationName}] ═════════════════════════════════════════`);
    
    if (isManualTrigger) {
      console.log(`[${locationName}] 🔍 MANUAL TRIGGER MODE ACTIVATED`);
      console.log(`[${locationName}] ✅ Using EXISTING data from database`);
      console.log(`[${locationName}] ❌ NOT fetching fresh data from buoy`);
      
      const { data: todayData, error: todayError } = await supabase
        .from('surf_conditions')
        .select('*')
        .eq('location', locationId)
        .eq('date', dateStr)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (todayError) {
        console.error(`[${locationName}] ❌ Error fetching today's surf_conditions:`, todayError);
      }
      
      console.log(`[${locationName}] 📊 Today's data:`, {
        exists: !!todayData,
        surf_height: todayData?.surf_height,
        wave_height: todayData?.wave_height,
        wind_speed: todayData?.wind_speed,
        water_temp: todayData?.water_temp,
        location: todayData?.location,
      });
      
      const todayHasValidWaves = todayData && 
        todayData.surf_height && 
        todayData.surf_height !== 'N/A' && 
        todayData.surf_height !== '';
      
      if (todayHasValidWaves) {
        console.log(`[${locationName}] ✅ Found VALID data for today (${dateStr})`);
        console.log(`[${locationName}] 📊 surf_height: ${todayData.surf_height}`);
        console.log(`[${locationName}] 📊 wave_height: ${todayData.wave_height}`);
        console.log(`[${locationName}] 📊 wind_speed: ${todayData.wind_speed}`);
        console.log(`[${locationName}] 📊 water_temp: ${todayData.water_temp}`);
        console.log(`[${locationName}] 📊 location field: ${todayData.location}`);
        
        // 🚨 CRITICAL: Force location field to be the correct locationId
        // DO NOT trust the location field from the database - it may be wrong
        surfConditions = {
          ...todayData,
          location: locationId, // ✅ ALWAYS override with the correct locationId
        };
        usedFallbackData = false;
        
        console.log(`[${locationName}] ✅ Using today's data with FORCED location: ${surfConditions.location}`);
      } else {
        console.log(`[${locationName}] ⚠️ Today's data has N/A wave data, looking for previous valid data...`);
        
        const { data: validData, error: validError } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', locationId)
          .neq('surf_height', 'N/A')
          .neq('wave_height', 'N/A')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (validError) {
          console.error(`[${locationName}] ❌ Error fetching valid data:`, validError);
        }
        
        if (validData) {
          console.log(`[${locationName}] ✅ Found previous VALID data from ${validData.date}`);
          console.log(`[${locationName}] 📊 surf_height: ${validData.surf_height}`);
          console.log(`[${locationName}] 📊 wave_height: ${validData.wave_height}`);
          console.log(`[${locationName}] 📊 updated_at: ${validData.updated_at}`);
          
          if (todayData) {
            console.log(`[${locationName}] 🔄 Creating HYBRID data: previous waves + today's conditions`);
            surfConditions = {
              ...validData,
              date: dateStr,
              location: locationId, // ✅ Force correct location
              wind_speed: todayData.wind_speed !== 'N/A' ? todayData.wind_speed : validData.wind_speed,
              wind_direction: todayData.wind_direction !== 'N/A' ? todayData.wind_direction : validData.wind_direction,
              water_temp: todayData.water_temp !== 'N/A' ? todayData.water_temp : validData.water_temp,
              updated_at: new Date().toISOString(),
            };
            console.log(`[${locationName}] ✅ Hybrid data created with FORCED location: ${surfConditions.location}`);
          } else {
            surfConditions = {
              ...validData,
              location: locationId, // ✅ Force correct location
            };
            console.log(`[${locationName}] ✅ Using previous data with FORCED location: ${surfConditions.location}`);
          }
          usedFallbackData = true;
        } else {
          console.error(`[${locationName}] ❌ No valid surf data available in database at all`);
          console.error(`[${locationName}] 💡 SOLUTION: Use "Update Data" button to pull fresh data from buoy first`);
          throw new Error('No valid surf data available in database - please pull fresh data using "Update Data" button first');
        }
      }
    } else {
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[${locationName}] Attempt ${attempt}/${MAX_RETRIES}: Fetching buoy data...`);
          
          const { data: buoyData, error: buoyError } = await supabase.functions.invoke('fetch-surf-reports', {
            body: { location: locationId },
          });

          if (buoyError) {
            console.warn(`[${locationName}] Attempt ${attempt}: Buoy fetch warning:`, buoyError);
          }

          await delay(2000);

          const { data: fetchedConditions, error: surfError } = await supabase
            .from('surf_conditions')
            .select('*')
            .eq('date', dateStr)
            .eq('location', locationId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (surfError) {
            throw new Error(`Failed to fetch surf conditions: ${surfError.message}`);
          }

          const hasWaveData = fetchedConditions && (
            (fetchedConditions.wave_height && fetchedConditions.wave_height !== 'N/A' && fetchedConditions.wave_height !== '') ||
            (fetchedConditions.surf_height && fetchedConditions.surf_height !== 'N/A' && fetchedConditions.surf_height !== '')
          );

          const hasBuoyData = fetchedConditions && (
            (fetchedConditions.wind_speed && fetchedConditions.wind_speed !== 'N/A') ||
            (fetchedConditions.water_temp && fetchedConditions.water_temp !== 'N/A')
          );

          if (hasWaveData) {
            console.log(`[${locationName}] ✅ Attempt ${attempt}: Valid wave data found!`);
            surfConditions = {
              ...fetchedConditions,
              location: locationId, // ✅ Ensure correct location
            };
            break;
          } else if (hasBuoyData) {
            console.log(`[${locationName}] ⚠️ Attempt ${attempt}: No wave data, but buoy is online (wind/temp available)`);
            
            if (attempt === MAX_RETRIES) {
              console.log(`[${locationName}] ✅ Max retries reached: Proceeding with available buoy data (wave sensors offline)`);
              surfConditions = {
                ...fetchedConditions,
                location: locationId, // ✅ Ensure correct location
              };
              usedFallbackData = true;
              break;
            }
            
            lastError = `Wave sensors offline, retrying... (${attempt}/${MAX_RETRIES})`;
          } else {
            const errorMsg = `No valid buoy data available`;
            console.log(`[${locationName}] ⚠️ Attempt ${attempt}/${MAX_RETRIES}: ${errorMsg}`);
            lastError = errorMsg;
          }
          
          if (attempt < MAX_RETRIES) {
            const delayMs = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
            console.log(`[${locationName}] ⏳ Waiting ${delayMs/1000} seconds before retry...`);
            await delay(delayMs);
          }
        } catch (attemptError: any) {
          console.error(`[${locationName}] Attempt ${attempt} error:`, attemptError);
          lastError = attemptError.message;
          
          if (attempt < MAX_RETRIES) {
            const delayMs = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
            await delay(delayMs);
          }
        }
      }
      
      if (!surfConditions) {
        console.error(`[${locationName}] ❌ All attempts failed. Trying to use previous valid data...`);
        
        const { data: previousValidData, error: prevError } = await supabase
          .from('surf_conditions')
          .select('*')
          .eq('location', locationId)
          .neq('surf_height', 'N/A')
          .neq('wave_height', 'N/A')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (prevError) {
          console.error(`[${locationName}] ❌ Error fetching previous valid data:`, prevError);
        }
        
        if (previousValidData) {
          console.log(`[${locationName}] ✅ Using previous valid data from ${previousValidData.date}`);
          surfConditions = {
            ...previousValidData,
            location: locationId, // ✅ Force correct location
          };
          usedFallbackData = true;
        } else {
          console.error(`[${locationName}] ❌ No valid data available at all. Last error: ${lastError}`);
          throw new Error(`Failed to fetch surf data: ${lastError}`);
        }
      }
    }

    if (!surfConditions) {
      console.error(`[${locationName}] ❌ No surf conditions available`);
      throw new Error('No surf conditions available');
    }

    // 🚨 CRITICAL: TRIPLE-CHECK that location field is correct before generating narrative
    if (!surfConditions.location || surfConditions.location !== locationId) {
      console.log(`[${locationName}] ⚠️ Location field mismatch or missing, correcting to: ${locationId}`);
      surfConditions.location = locationId;
    }

    console.log(`[${locationName}] ═════════════════════════════════════════`);
    console.log(`[${locationName}] 📊 FINAL SURF CONDITIONS FOR NARRATIVE`);
    console.log(`[${locationName}] location: ${surfConditions.location}`);
    console.log(`[${locationName}] surf_height: ${surfConditions.surf_height}`);
    console.log(`[${locationName}] wave_height: ${surfConditions.wave_height}`);
    console.log(`[${locationName}] wind_speed: ${surfConditions.wind_speed}`);
    console.log(`[${locationName}] wind_direction: ${surfConditions.wind_direction}`);
    console.log(`[${locationName}] water_temp: ${surfConditions.water_temp}`);
    console.log(`[${locationName}] wave_period: ${surfConditions.wave_period}`);
    console.log(`[${locationName}] swell_direction: ${surfConditions.swell_direction}`);
    console.log(`[${locationName}] ═════════════════════════════════════════`);

    const hasValidWaveData = surfConditions && (
      (surfConditions.wave_height && surfConditions.wave_height !== 'N/A' && surfConditions.wave_height !== '') ||
      (surfConditions.surf_height && surfConditions.surf_height !== 'N/A' && surfConditions.surf_height !== '')
    );

    console.log(`[${locationName}] 🌊 Wave sensors status: ${hasValidWaveData ? 'ONLINE ✅' : 'OFFLINE ⚠️'}`);
    console.log(`[${locationName}] 🌤️ Weather data available:`, !!weatherData);
    console.log(`[${locationName}] 🔄 Used fallback data:`, usedFallbackData);
    
    const captureTime = surfConditions.updated_at 
      ? new Date(surfConditions.updated_at).toLocaleTimeString('en-US', { 
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true 
        })
      : '6:00 AM';

    console.log(`[${locationName}] ═════════════════════════════════════════`);
    console.log(`[${locationName}] 📝 CALLING generateWittyNarrative`);
    console.log(`[${locationName}] 🎯 Passing locationId as OVERRIDE: ${locationId}`);
    console.log(`[${locationName}] 🎯 surfConditions.location (will be IGNORED): ${surfConditions.location}`);
    console.log(`[${locationName}] ═════════════════════════════════════════`);
    
    // 🚨 CRITICAL FIX: ALWAYS pass locationId as the override parameter
    // This ensures the narrative ALWAYS uses the correct location name
    // The surfConditions.location field is IGNORED when locationIdOverride is provided
    const narrative = generateWittyNarrative(
      surfConditions, 
      captureTime, 
      dateStr,
      weatherData,
      locationId // ✅ ALWAYS pass locationId to ensure correct location in narrative
    );
    
    console.log(`[${locationName}] ═════════════════════════════════════════`);
    console.log(`[${locationName}] ✅ NARRATIVE GENERATION COMPLETE`);
    console.log(`[${locationName}] 📏 Length: ${narrative.length} characters`);
    console.log(`[${locationName}] 📄 Preview: ${narrative.substring(0, 150)}...`);
    console.log(`[${locationName}] 🔍 Contains \\n\\n: ${narrative.includes('\n\n')}`);
    console.log(`[${locationName}] 🔍 Newline count: ${(narrative.match(/\n\n/g) || []).length}`);
    
    // 🚨 VERIFICATION: Check if the narrative contains the correct location name
    const verifyPersonality = getLocationPersonality(locationId);
    const containsCorrectLocation = narrative.includes(verifyPersonality.nickname);
    console.log(`[${locationName}] 🔍 Location verification: ${containsCorrectLocation ? '✅ CORRECT' : '❌ WRONG'}`);
    if (!containsCorrectLocation) {
      console.error(`[${locationName}] ❌ CRITICAL: Narrative does NOT contain "${verifyPersonality.nickname}"!`);
      console.error(`[${locationName}] ❌ Narrative preview:`, narrative.substring(0, 200));
      console.error(`[${locationName}] ❌ LocationId used:`, locationId);
      console.error(`[${locationName}] ❌ This is a BUG - the narrative should ALWAYS contain the correct location!`);
    }
    console.log(`[${locationName}] ═════════════════════════════════════════`);

    const rating = calculateSurfRating(surfConditions);
    console.log(`[${locationName}] ⭐ Calculated rating: ${rating}/10`);

    // 🚨 CRITICAL FIX: Store narrative in BOTH conditions AND report_text fields
    // This ensures compatibility with both old and new frontend code
    const reportData = {
      date: dateStr,
      location: locationId,
      wave_height: surfConditions.wave_height || 'N/A',
      surf_height: surfConditions.surf_height || surfConditions.wave_height || 'N/A',
      wave_period: surfConditions.wave_period || 'N/A',
      swell_direction: surfConditions.swell_direction || 'N/A',
      wind_speed: surfConditions.wind_speed || 'N/A',
      wind_direction: surfConditions.wind_direction || 'N/A',
      water_temp: surfConditions.water_temp || 'N/A',
      tide: 'See tide times',
      conditions: narrative, // ✅ Store in conditions field (primary)
      report_text: narrative, // ✅ ALSO store in report_text field (backup)
      rating: rating,
      updated_at: new Date().toISOString(),
    };

    console.log(`[${locationName}] ═════════════════════════════════════════`);
    console.log(`[${locationName}] 💾 UPSERTING REPORT TO DATABASE`);
    console.log(`[${locationName}] 💾 Date: ${dateStr}, Location: ${locationId}`);
    console.log(`[${locationName}] 💾 Narrative length: ${narrative.length} chars`);
    console.log(`[${locationName}] 💾 Storing in BOTH conditions and report_text fields`);
    console.log(`[${locationName}] 💾 Rating: ${rating}/10`);
    console.log(`[${locationName}] ═════════════════════════════════════════`);

    const { error: upsertError } = await supabase
      .from('surf_reports')
      .upsert(reportData, { onConflict: 'date,location' });

    if (upsertError) {
      console.error(`[${locationName}] ❌ Failed to save report:`, upsertError);
      throw new Error(`Failed to save report: ${upsertError.message}`);
    }

    console.log(`[${locationName}] ✅ Report saved successfully to database`);
    
    // 🚨 CRITICAL: Wait for database to propagate
    await delay(1000);
    
    console.log(`[${locationName}] 🔍 Verifying save...`);
    const { data: verifyData, error: verifyError } = await supabase
      .from('surf_reports')
      .select('id, date, location, surf_height, wave_height, conditions, report_text, rating, updated_at')
      .eq('date', dateStr)
      .eq('location', locationId)
      .maybeSingle();
    
    if (verifyError) {
      console.error(`[${locationName}] ⚠️ Could not verify save:`, verifyError);
    } else if (verifyData) {
      console.log(`[${locationName}] ═════════════════════════════════════════`);
      console.log(`[${locationName}] ✅ VERIFICATION SUCCESSFUL`);
      console.log(`[${locationName}] ✅ Report ID: ${verifyData.id}`);
      console.log(`[${locationName}] ✅ surf_height: ${verifyData.surf_height}`);
      console.log(`[${locationName}] ✅ wave_height: ${verifyData.wave_height}`);
      console.log(`[${locationName}] ✅ conditions: ${verifyData.conditions?.length || 0} characters`);
      console.log(`[${locationName}] ✅ report_text: ${verifyData.report_text?.length || 0} characters`);
      console.log(`[${locationName}] ✅ rating: ${verifyData.rating}/10`);
      console.log(`[${locationName}] ✅ Newlines in conditions: ${verifyData.conditions?.includes('\n\n') ? 'YES' : 'NO'}`);
      console.log(`[${locationName}] ✅ Newlines in report_text: ${verifyData.report_text?.includes('\n\n') ? 'YES' : 'NO'}`);
      console.log(`[${locationName}] ✅ updated_at: ${verifyData.updated_at}`);
      
      // 🚨 FINAL VERIFICATION: Check if saved narrative contains correct location
      const savedPersonality = getLocationPersonality(locationId);
      const savedContainsCorrectLocation = verifyData.conditions?.includes(savedPersonality.nickname);
      console.log(`[${locationName}] 🔍 Saved narrative location check: ${savedContainsCorrectLocation ? '✅ CORRECT' : '❌ WRONG'}`);
      if (!savedContainsCorrectLocation) {
        console.error(`[${locationName}] ❌ CRITICAL: Saved narrative does NOT contain "${savedPersonality.nickname}"!`);
        console.error(`[${locationName}] ❌ Saved narrative preview:`, verifyData.conditions?.substring(0, 200));
      }
      
      console.log(`[${locationName}] ═════════════════════════════════════════`);
    } else {
      console.warn(`[${locationName}] ⚠️ Report not found after save - possible race condition`);
    }

    return {
      success: true,
      location: locationName,
      locationId: locationId,
      date: dateStr,
      captureTime: captureTime,
      rating: rating,
      hasWaveData: hasValidWaveData,
      usedFallbackData: usedFallbackData,
      narrativeLength: narrative.length,
    };

  } catch (error: any) {
    console.error(`[${locationName}] ❌ Failed:`, error.message);
    console.error(`[${locationName}] ❌ Stack:`, error.stack);
    return {
      success: false,
      location: locationName,
      locationId: locationId,
      error: error.message,
    };
  }
}
