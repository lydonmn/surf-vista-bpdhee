
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get EST date
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
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Calculate moving average
function calculateMovingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((sum, val) => sum + val, 0) / slice.length;
}

// Calculate trend (linear regression slope)
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, val) => sum + val, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// Calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// Predict surf height using multiple factors
function predictSurfHeight(
  historicalData: any[],
  currentConditions: any,
  daysAhead: number
): { min: number, max: number, confidence: number, factors: any } {
  
  // Extract historical wave heights
  const waveHeights = historicalData
    .map(d => parseFloat(d.wave_height?.match(/(\d+\.?\d*)/)?.[1] || '0'))
    .filter(h => h > 0);
  
  // Extract historical periods
  const periods = historicalData
    .map(d => parseFloat(d.wave_period?.match(/(\d+\.?\d*)/)?.[1] || '0'))
    .filter(p => p > 0);
  
  // Calculate baseline statistics
  const avgWaveHeight = waveHeights.length > 0 
    ? waveHeights.reduce((sum, h) => sum + h, 0) / waveHeights.length 
    : 2.0;
  
  const avgPeriod = periods.length > 0
    ? periods.reduce((sum, p) => sum + p, 0) / periods.length
    : 8.0;
  
  // Calculate trends
  const waveHeightTrend = calculateTrend(waveHeights.slice(-7)); // Last 7 days
  const movingAvg3Day = calculateMovingAverage(waveHeights, 3);
  const movingAvg7Day = calculateMovingAverage(waveHeights, 7);
  
  // Calculate volatility
  const volatility = calculateStdDev(waveHeights.slice(-7));
  
  // Get current conditions
  const currentWaveHeight = parseFloat(currentConditions?.wave_height?.match(/(\d+\.?\d*)/)?.[1] || avgWaveHeight.toString());
  const currentPeriod = parseFloat(currentConditions?.wave_period?.match(/(\d+\.?\d*)/)?.[1] || avgPeriod.toString());
  
  // Prediction algorithm combining multiple factors
  let predictedWaveHeight = currentWaveHeight;
  
  // Factor 1: Trend continuation (30% weight)
  predictedWaveHeight += waveHeightTrend * daysAhead * 0.3;
  
  // Factor 2: Mean reversion (20% weight) - waves tend to return to average
  const meanReversionFactor = (avgWaveHeight - currentWaveHeight) * 0.2;
  predictedWaveHeight += meanReversionFactor * (daysAhead / 7);
  
  // Factor 3: Moving average convergence (25% weight)
  const maConvergence = (movingAvg3Day - movingAvg7Day) * 0.25;
  predictedWaveHeight += maConvergence;
  
  // Factor 4: Seasonal adjustment (15% weight)
  const month = new Date().getMonth();
  const seasonalFactor = month >= 5 && month <= 9 ? 1.1 : 0.9; // Summer boost
  predictedWaveHeight *= (1 + (seasonalFactor - 1) * 0.15);
  
  // Factor 5: Period influence (10% weight)
  const periodFactor = currentPeriod / avgPeriod;
  predictedWaveHeight *= (1 + (periodFactor - 1) * 0.1);
  
  // Add uncertainty based on days ahead and volatility
  const uncertaintyFactor = Math.min(volatility * (1 + daysAhead * 0.2), 2.0);
  
  // Calculate confidence (decreases with days ahead and volatility)
  const confidence = Math.max(0.3, Math.min(0.95, 
    0.9 - (daysAhead * 0.08) - (volatility * 0.1)
  ));
  
  // Calculate range
  const minHeight = Math.max(0.5, predictedWaveHeight - uncertaintyFactor);
  const maxHeight = predictedWaveHeight + uncertaintyFactor;
  
  // Convert wave height to surf height (rideable face)
  const surfMultiplier = currentPeriod >= 12 ? 0.65 : currentPeriod >= 8 ? 0.55 : 0.45;
  
  return {
    min: Math.round(minHeight * surfMultiplier * 2) / 2,
    max: Math.round(maxHeight * surfMultiplier * 2) / 2,
    confidence: Math.round(confidence * 100) / 100,
    factors: {
      trend: waveHeightTrend,
      movingAvg3Day,
      movingAvg7Day,
      volatility,
      currentWaveHeight,
      currentPeriod,
      avgWaveHeight,
      avgPeriod,
      seasonalFactor,
      uncertaintyFactor
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== ANALYZE SURF TRENDS STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = getESTDate(0);
    console.log('Analyzing trends for date:', today);

    // Fetch historical surf conditions (last 30 days)
    const thirtyDaysAgo = getESTDate(-30);
    const { data: historicalData, error: histError } = await supabase
      .from('surf_conditions')
      .select('*')
      .gte('date', thirtyDaysAgo)
      .lte('date', today)
      .order('date', { ascending: true });

    if (histError) {
      console.error('Error fetching historical data:', histError);
      throw histError;
    }

    console.log(`Fetched ${historicalData?.length || 0} historical records`);

    // Get current conditions
    const { data: currentConditions, error: currentError } = await supabase
      .from('surf_conditions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (currentError) {
      console.error('Error fetching current conditions:', currentError);
    }

    console.log('Current conditions:', currentConditions);

    // Generate predictions for next 7 days
    const predictions = [];
    
    for (let i = 1; i <= 7; i++) {
      const targetDate = getESTDate(i);
      const prediction = predictSurfHeight(
        historicalData || [],
        currentConditions,
        i
      );
      
      predictions.push({
        date: targetDate,
        predicted_surf_min: prediction.min,
        predicted_surf_max: prediction.max,
        confidence: prediction.confidence,
        prediction_factors: prediction.factors,
        created_at: new Date().toISOString(),
      });
      
      console.log(`Prediction for ${targetDate} (${i} days ahead):`, {
        range: `${prediction.min}-${prediction.max} ft`,
        confidence: `${(prediction.confidence * 100).toFixed(0)}%`
      });
    }

    // Store predictions in database
    const { data: insertedPredictions, error: insertError } = await supabase
      .from('surf_predictions')
      .upsert(predictions, { onConflict: 'date' })
      .select();

    if (insertError) {
      console.error('Error storing predictions:', insertError);
      throw insertError;
    }

    console.log(`Stored ${insertedPredictions?.length || 0} predictions`);

    // Calculate aggregate statistics
    const stats = {
      historical_avg: historicalData && historicalData.length > 0
        ? historicalData
            .map(d => parseFloat(d.wave_height?.match(/(\d+\.?\d*)/)?.[1] || '0'))
            .filter(h => h > 0)
            .reduce((sum, h) => sum + h, 0) / historicalData.length
        : 0,
      historical_count: historicalData?.length || 0,
      predictions_generated: predictions.length,
      avg_confidence: predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length,
    };

    console.log('Analysis statistics:', stats);
    console.log('=== ANALYZE SURF TRENDS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Surf trend analysis completed successfully',
        predictions,
        statistics: stats,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== ANALYZE SURF TRENDS FAILED ===');
    console.error('Error:', error);
    
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
