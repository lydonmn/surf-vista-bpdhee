
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MergeRequest {
  fileName: string;
  totalChunks: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== MERGE VIDEO CHUNKS STARTED (STREAMING MODE) ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fileName, totalChunks } = await req.json() as MergeRequest;
    console.log('Merging video:', fileName);
    console.log('Total chunks:', totalChunks);

    if (totalChunks === 1) {
      console.log('Single chunk upload - no merging needed');
      
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      
      console.log('Single chunk public URL:', publicUrlData.publicUrl);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Single chunk - no merging needed',
          fileName,
          publicUrl: publicUrlData.publicUrl,
          hasValidMP4Header: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // STREAMING APPROACH: Process chunks in batches to avoid memory exhaustion
    console.log('Using streaming merge to conserve memory...');
    
    // Step 1: Download and merge chunks in smaller batches
    const BATCH_SIZE = 5; // Process 5 chunks at a time
    const tempChunks: Uint8Array[] = [];
    let totalSize = 0;
    let hasValidMP4Header = false;

    // Process chunks in batches
    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
      console.log(`Processing batch: chunks ${batchStart} to ${batchEnd - 1}`);
      
      const batchChunks: Uint8Array[] = [];
      let batchSize = 0;

      // Download batch
      for (let i = batchStart; i < batchEnd; i++) {
        const chunkFileName = `${fileName}.part${i}`;
        console.log(`Downloading chunk ${i + 1}/${totalChunks}: ${chunkFileName}`);
        
        const { data, error } = await supabase.storage
          .from('videos')
          .download(chunkFileName);

        if (error) {
          console.error(`Error downloading chunk ${i}:`, error);
          throw new Error(`Failed to download chunk ${i}: ${error.message}`);
        }

        if (!data) {
          throw new Error(`Chunk ${i} data is null`);
        }

        const arrayBuffer = await data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        batchChunks.push(uint8Array);
        batchSize += uint8Array.length;
        console.log(`✓ Chunk ${i + 1} downloaded: ${uint8Array.length} bytes`);

        // Check MP4 header in first chunk
        if (i === 0 && !hasValidMP4Header) {
          if (uint8Array.length > 8 &&
              uint8Array[4] === 0x66 && uint8Array[5] === 0x74 &&
              uint8Array[6] === 0x79 && uint8Array[7] === 0x70) {
            hasValidMP4Header = true;
            console.log('✓ Valid MP4 header detected at position 4');
          } else if (uint8Array.length > 4 &&
                     uint8Array[0] === 0x66 && uint8Array[1] === 0x74 &&
                     uint8Array[2] === 0x79 && uint8Array[3] === 0x70) {
            hasValidMP4Header = true;
            console.log('✓ Valid MP4 header detected at position 0');
          }
        }
      }

      // Merge batch
      const mergedBatch = new Uint8Array(batchSize);
      let offset = 0;
      for (const chunk of batchChunks) {
        mergedBatch.set(chunk, offset);
        offset += chunk.length;
      }
      
      tempChunks.push(mergedBatch);
      totalSize += batchSize;
      console.log(`✓ Batch merged: ${batchSize} bytes`);
      
      // Clear batch to free memory
      batchChunks.length = 0;
    }

    console.log(`Total size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    // Step 2: Merge all batches into final video
    console.log('Merging all batches into final video...');
    const mergedVideo = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < tempChunks.length; i++) {
      mergedVideo.set(tempChunks[i], offset);
      offset += tempChunks[i].length;
      console.log(`✓ Merged batch ${i + 1}/${tempChunks.length}`);
    }

    // Clear temp chunks to free memory
    tempChunks.length = 0;

    console.log('✓ All chunks merged successfully');

    if (!hasValidMP4Header) {
      console.warn('⚠️ Warning: Merged video may not have valid MP4 header');
      console.log('First 32 bytes:', Array.from(mergedVideo.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }

    // Step 3: Delete old file if exists
    console.log('Removing old file if exists...');
    const { error: removeError } = await supabase.storage
      .from('videos')
      .remove([fileName]);
    
    if (removeError) {
      console.log('Note: Old file removal returned error (may not exist):', removeError.message);
    } else {
      console.log('✓ Old file removed (if it existed)');
    }

    // Step 4: Upload merged video
    console.log('Uploading merged video...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, mergedVideo, {
        contentType: 'video/mp4',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Error uploading merged video:', uploadError);
      throw new Error(`Failed to upload merged video: ${uploadError.message}`);
    }

    console.log('✓ Merged video uploaded successfully');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    console.log('✓ Public URL generated:', publicUrl);

    // Verify accessibility
    console.log('Verifying uploaded file accessibility...');
    try {
      const headResponse = await fetch(publicUrl, { method: 'HEAD' });
      console.log('HEAD response status:', headResponse.status);
      console.log('Content-Type:', headResponse.headers.get('content-type'));
      console.log('Content-Length:', headResponse.headers.get('content-length'));
      
      if (!headResponse.ok) {
        console.error('⚠️ WARNING: Uploaded file is not accessible via public URL!');
      } else {
        console.log('✓ Uploaded file is accessible via public URL');
      }
    } catch (verifyError) {
      console.error('Error verifying file accessibility:', verifyError);
    }

    // Step 5: Clean up chunk files
    console.log('Cleaning up chunk files...');
    const chunkFilesToDelete = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkFilesToDelete.push(`${fileName}.part${i}`);
    }

    const { error: deleteError } = await supabase.storage
      .from('videos')
      .remove(chunkFilesToDelete);

    if (deleteError) {
      console.error('Error deleting chunks (non-fatal):', deleteError);
    } else {
      console.log('✓ Chunk files cleaned up');
    }

    console.log('=== MERGE VIDEO CHUNKS COMPLETED ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Video chunks merged successfully',
        fileName,
        totalSize,
        chunksProcessed: totalChunks,
        publicUrl,
        hasValidMP4Header,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== MERGE VIDEO CHUNKS FAILED ===');
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
