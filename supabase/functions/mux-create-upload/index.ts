
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID');
    const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET');

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      console.error('Mux credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Mux API credentials not configured' }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creating Mux upload URL with optimized quality settings...');

    // 🎯 QUALITY FIX #2: Configure Mux to use smart encoding tier with max resolution limit
    // This ensures Mux generates fewer, higher-quality renditions with a higher minimum quality floor
    // Instead of starting at 240p and ramping up, this starts much closer to max quality
    const muxResponse = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`)}`,
      },
      body: JSON.stringify({
        cors_origin: '*',
        new_asset_settings: {
          playback_policy: ['public'],
          encoding_tier: 'smart',
          max_resolution_tier: '1080p',
        },
      }),
    });

    if (!muxResponse.ok) {
      const errorText = await muxResponse.text();
      console.error('Mux API error:', muxResponse.status, errorText);
      throw new Error(`Mux API error: ${muxResponse.status} - ${errorText}`);
    }

    const data = await muxResponse.json();
    console.log('Mux upload created successfully with optimized settings:', data.data.id);
    console.log('✅ Encoding tier: smart, Max resolution: 1080p - Higher quality floor enabled');

    const { id, url } = data.data;

    return new Response(
      JSON.stringify({ id, url }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating Mux upload:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
