
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MUX_WEBHOOK_SECRET = Deno.env.get('MUX_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 🎬 Mux HLS URL prefix
const MUX_HLS_PREFIX = 'https://stream.mux.com/';

// Verify Mux webhook signature
async function verifyMuxSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Mux signature format: "t=timestamp,v1=signature"
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !sig) {
      return false;
    }

    // Create the signed payload
    const signedPayload = `${timestamp}.${body}`;

    // Compute HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex
    const computedSig = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedSig === sig;
  } catch (error) {
    console.error('[mux-webhook] Error verifying signature:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const signature = req.headers.get('mux-signature');
    const rawBody = await req.text();

    console.log('[mux-webhook] 📥 Received webhook');
    console.log('[mux-webhook] Signature present:', !!signature);

    // Verify signature if secret is configured
    if (MUX_WEBHOOK_SECRET) {
      const isValid = await verifyMuxSignature(rawBody, signature, MUX_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('[mux-webhook] ❌ Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.log('[mux-webhook] ✅ Signature verified');
    } else {
      console.warn('[mux-webhook] ⚠️ MUX_WEBHOOK_SECRET not configured - skipping signature verification');
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type;

    console.log('[mux-webhook] 📊 Event type:', eventType);

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle video.asset.ready event
    if (eventType === 'video.asset.ready') {
      const assetId = payload.data?.id;
      const playbackIds = payload.data?.playback_ids;
      const playbackId = playbackIds?.[0]?.id;

      console.log('[mux-webhook] 🎬 Asset ready event');
      console.log('[mux-webhook] Asset ID:', assetId);
      console.log('[mux-webhook] Playback ID:', playbackId);
      console.log('[mux-webhook] Full payload:', JSON.stringify(payload, null, 2));

      if (!assetId || !playbackId) {
        console.error('[mux-webhook] ❌ Missing asset ID or playback ID');
        return new Response(
          JSON.stringify({ error: 'Missing asset ID or playback ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Construct the HLS playback URL
      const videoUrl = `${MUX_HLS_PREFIX}${playbackId}.m3u8`;
      console.log('[mux-webhook] 🎥 HLS URL:', videoUrl);

      // Update the video record in the database
      // Match by mux_asset_id since that's what we store when creating the upload
      const { data: updateData, error: updateError } = await supabase
        .from('videos')
        .update({
          video_url: videoUrl,
          status: 'active',
          mux_asset_id: assetId,
          updated_at: new Date().toISOString(),
        })
        .eq('mux_asset_id', assetId)
        .select();

      if (updateError) {
        console.error('[mux-webhook] ❌ Error updating video:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update video', details: updateError }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!updateData || updateData.length === 0) {
        console.warn('[mux-webhook] ⚠️ No video found with mux_asset_id:', assetId);
        // Log all videos to help debug
        const { data: allVideos } = await supabase
          .from('videos')
          .select('id, mux_upload_id, mux_asset_id, status, video_url')
          .order('created_at', { ascending: false })
          .limit(5);
        console.log('[mux-webhook] Recent videos:', JSON.stringify(allVideos, null, 2));
        
        return new Response(
          JSON.stringify({ message: 'No matching video found' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('[mux-webhook] ✅ Video updated successfully:', updateData[0].id);
      console.log('[mux-webhook] 🎬 Video URL set to:', videoUrl);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Video updated successfully',
          videoId: updateData[0].id,
          videoUrl: videoUrl
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle video.asset.errored event
    if (eventType === 'video.asset.errored') {
      const assetId = payload.data?.id;
      const errors = payload.data?.errors || [];
      const errorMessage = errors.map((e: any) => e.message).join(', ') || 'Unknown error';

      console.log('[mux-webhook] ❌ Asset errored event');
      console.log('[mux-webhook] Asset ID:', assetId);
      console.log('[mux-webhook] Error:', errorMessage);

      if (!assetId) {
        console.error('[mux-webhook] ❌ Missing asset ID');
        return new Response(
          JSON.stringify({ error: 'Missing asset ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update the video record to errored status
      const { data: updateData, error: updateError } = await supabase
        .from('videos')
        .update({
          status: 'errored',
          updated_at: new Date().toISOString(),
        })
        .eq('mux_asset_id', assetId)
        .select();

      if (updateError) {
        console.error('[mux-webhook] ❌ Error updating video to errored:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update video', details: updateError }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!updateData || updateData.length === 0) {
        console.warn('[mux-webhook] ⚠️ No video found with mux_asset_id:', assetId);
        return new Response(
          JSON.stringify({ message: 'No matching video found' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('[mux-webhook] ✅ Video marked as errored:', updateData[0].id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Video marked as errored',
          videoId: updateData[0].id
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle video.upload.asset_created event (when upload completes and asset is created)
    if (eventType === 'video.upload.asset_created') {
      const uploadId = payload.data?.id;
      const assetId = payload.data?.asset_id;

      console.log('[mux-webhook] 📤 Upload asset created event');
      console.log('[mux-webhook] Upload ID:', uploadId);
      console.log('[mux-webhook] Asset ID:', assetId);
      console.log('[mux-webhook] Full payload:', JSON.stringify(payload, null, 2));

      if (!uploadId || !assetId) {
        console.error('[mux-webhook] ❌ Missing upload ID or asset ID');
        return new Response(
          JSON.stringify({ error: 'Missing upload ID or asset ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update the video record with the asset ID
      // This links the upload to the asset for future webhook events
      const { data: updateData, error: updateError } = await supabase
        .from('videos')
        .update({
          mux_asset_id: assetId,
          updated_at: new Date().toISOString(),
        })
        .eq('mux_upload_id', uploadId)
        .select();

      if (updateError) {
        console.error('[mux-webhook] ❌ Error updating video with asset ID:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update video', details: updateError }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!updateData || updateData.length === 0) {
        console.warn('[mux-webhook] ⚠️ No video found with mux_upload_id:', uploadId);
        // Log all videos to help debug
        const { data: allVideos } = await supabase
          .from('videos')
          .select('id, mux_upload_id, mux_asset_id, status')
          .order('created_at', { ascending: false })
          .limit(5);
        console.log('[mux-webhook] Recent videos:', JSON.stringify(allVideos, null, 2));
        
        return new Response(
          JSON.stringify({ message: 'No matching video found' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('[mux-webhook] ✅ Video updated with asset ID:', updateData[0].id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Video updated with asset ID',
          videoId: updateData[0].id,
          assetId: assetId
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ignore other event types
    console.log('[mux-webhook] ℹ️ Ignoring event type:', eventType);
    return new Response(
      JSON.stringify({ message: `Event type ${eventType} ignored` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mux-webhook] ❌ Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
