
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

    // Get uploadId from query params or POST body
    const url = new URL(req.url);
    let uploadId = url.searchParams.get('uploadId');

    if (!uploadId && req.method === 'POST') {
      const body = await req.json();
      uploadId = body.uploadId;
    }

    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: 'Missing uploadId parameter' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Checking Mux upload status for:', uploadId);

    // Get upload details to find asset_id
    const uploadResponse = await fetch(
      `https://api.mux.com/video/v1/uploads/${uploadId}`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`)}`,
        },
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Mux Upload API error:', uploadResponse.status, errorText);
      throw new Error(`Mux Upload API error: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset_id;

    if (!assetId) {
      console.log('Upload not yet processed, asset_id not available');
      return new Response(
        JSON.stringify({ status: 'waiting' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Asset ID found:', assetId);

    // Get asset details to check status
    const assetResponse = await fetch(
      `https://api.mux.com/video/v1/assets/${assetId}`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`)}`,
        },
      }
    );

    if (!assetResponse.ok) {
      const errorText = await assetResponse.text();
      console.error('Mux Asset API error:', assetResponse.status, errorText);
      throw new Error(`Mux Asset API error: ${assetResponse.status} - ${errorText}`);
    }

    const assetData = await assetResponse.json();
    const { status, playback_ids } = assetData.data;
    const playbackId = playback_ids && playback_ids.length > 0 ? playback_ids[0].id : null;
    const hlsUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;

    console.log('Asset status:', status, 'Playback ID:', playbackId);

    return new Response(
      JSON.stringify({ 
        status, 
        asset_id: assetId, 
        playback_id: playbackId, 
        hls_url: hlsUrl 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error checking Mux asset status:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
