
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { fileName, totalChunks } = await req.json();

    console.log(`[merge-video-chunks] Starting merge for ${fileName} with ${totalChunks} chunks`);

    // Download all chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileName}.part${i}`;
      console.log(`[merge-video-chunks] Downloading chunk ${i + 1}/${totalChunks}: ${chunkFileName}`);

      const { data, error } = await supabaseClient.storage
        .from('videos')
        .download(chunkFileName);

      if (error) {
        throw new Error(`Failed to download chunk ${i}: ${error.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuffer));
    }

    console.log(`[merge-video-chunks] All chunks downloaded, merging...`);

    // Calculate total size
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`[merge-video-chunks] Total size: ${totalSize} bytes`);

    // Merge chunks
    const mergedVideo = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      mergedVideo.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`[merge-video-chunks] Chunks merged, uploading final video...`);

    // Upload merged video
    const { error: uploadError } = await supabaseClient.storage
      .from('videos')
      .upload(fileName, mergedVideo, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload merged video: ${uploadError.message}`);
    }

    console.log(`[merge-video-chunks] Final video uploaded, cleaning up chunks...`);

    // Delete chunk files
    const chunkFileNames = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkFileNames.push(`${fileName}.part${i}`);
    }

    const { error: deleteError } = await supabaseClient.storage
      .from('videos')
      .remove(chunkFileNames);

    if (deleteError) {
      console.error(`[merge-video-chunks] Warning: Failed to delete chunks: ${deleteError.message}`);
      // Don't throw error, chunks can be cleaned up manually
    }

    console.log(`[merge-video-chunks] ✓ Merge complete for ${fileName}`);

    return new Response(
      JSON.stringify({ success: true, fileName }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[merge-video-chunks] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
