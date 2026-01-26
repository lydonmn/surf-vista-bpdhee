
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
    console.log('=== MERGE VIDEO CHUNKS STARTED (MEMORY-OPTIMIZED) ===');
    
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

    // MEMORY-OPTIMIZED APPROACH: Merge in small batches to avoid memory exhaustion
    console.log('Using memory-optimized batch merge...');
    
    const BATCH_SIZE = 3; // Process 3 chunks at a time to minimize memory usage
    let totalSize = 0;
    let hasValidMP4Header = false;
    const tempFiles: string[] = [];

    // Step 1: Merge chunks in small batches
    console.log(`Step 1: Merging chunks in batches of ${BATCH_SIZE}...`);
    
    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
      const batchNum = Math.floor(batchStart / BATCH_SIZE);
      console.log(`Processing batch ${batchNum + 1}: chunks ${batchStart} to ${batchEnd - 1}`);
      
      const batchChunks: Uint8Array[] = [];
      let batchSize = 0;

      // Download batch chunks
      for (let i = batchStart; i < batchEnd; i++) {
        const chunkFileName = `${fileName}.part${i}`;
        console.log(`Downloading chunk ${i + 1}/${totalChunks}`);
        
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
        totalSize += uint8Array.length;
        console.log(`✓ Chunk ${i + 1} downloaded: ${uint8Array.length} bytes`);

        // Check MP4 header in first chunk
        if (i === 0) {
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

      // Merge batch chunks
      console.log(`Merging batch ${batchNum + 1} (${batchSize} bytes)...`);
      const mergedBatch = new Uint8Array(batchSize);
      let offset = 0;
      for (const chunk of batchChunks) {
        mergedBatch.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Upload merged batch as temporary file
      const tempFileName = `${fileName}.temp${batchNum}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(tempFileName, mergedBatch, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading batch:', uploadError);
        throw new Error(`Failed to upload batch ${batchNum}: ${uploadError.message}`);
      }
      
      tempFiles.push(tempFileName);
      console.log(`✓ Batch ${batchNum + 1} uploaded as ${tempFileName}`);
      
      // Clear batch to free memory
      batchChunks.length = 0;
    }

    console.log(`Total size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`Created ${tempFiles.length} temporary batch files`);

    // Step 2: Merge all batch files into final video
    console.log('Step 2: Merging batch files into final video...');
    
    if (tempFiles.length === 1) {
      // Only one batch - just rename it
      console.log('Only one batch file - renaming to final name...');
      
      const { data: finalData, error: downloadError } = await supabase.storage
        .from('videos')
        .download(tempFiles[0]);

      if (downloadError) {
        throw new Error(`Failed to download batch file: ${downloadError.message}`);
      }

      // Remove old file if exists
      await supabase.storage.from('videos').remove([fileName]);

      // Upload as final file
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, finalData, {
          contentType: 'video/mp4',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(`Failed to upload final file: ${uploadError.message}`);
      }
    } else {
      // Multiple batches - merge them
      console.log(`Merging ${tempFiles.length} batch files...`);
      
      const finalChunks: Uint8Array[] = [];
      let finalSize = 0;

      for (let i = 0; i < tempFiles.length; i++) {
        console.log(`Downloading batch file ${i + 1}/${tempFiles.length}`);
        
        const { data, error } = await supabase.storage
          .from('videos')
          .download(tempFiles[i]);

        if (error) {
          throw new Error(`Failed to download batch file ${i}: ${error.message}`);
        }

        const arrayBuffer = await data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        finalChunks.push(uint8Array);
        finalSize += uint8Array.length;
        console.log(`✓ Batch file ${i + 1} downloaded: ${uint8Array.length} bytes`);
      }

      // Merge all batch files
      console.log('Merging all batch files...');
      const mergedVideo = new Uint8Array(finalSize);
      let offset = 0;

      for (let i = 0; i < finalChunks.length; i++) {
        mergedVideo.set(finalChunks[i], offset);
        offset += finalChunks[i].length;
        console.log(`✓ Merged batch ${i + 1}/${finalChunks.length}`);
      }

      // Clear to free memory
      finalChunks.length = 0;

      // Remove old file if exists
      await supabase.storage.from('videos').remove([fileName]);

      // Upload final merged video
      console.log('Uploading final merged video...');
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, mergedVideo, {
          contentType: 'video/mp4',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(`Failed to upload final video: ${uploadError.message}`);
      }
    }

    console.log('✓ Final video uploaded successfully');

    if (!hasValidMP4Header) {
      console.warn('⚠️ Warning: Merged video may not have valid MP4 header');
    }

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

    // Step 3: Clean up temporary files
    console.log('Step 3: Cleaning up temporary files...');
    
    // Delete original chunk files
    const chunkFilesToDelete = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkFilesToDelete.push(`${fileName}.part${i}`);
    }

    const { error: deleteChunksError } = await supabase.storage
      .from('videos')
      .remove(chunkFilesToDelete);

    if (deleteChunksError) {
      console.error('Error deleting chunks (non-fatal):', deleteChunksError);
    } else {
      console.log('✓ Chunk files cleaned up');
    }

    // Delete batch temp files
    const { error: deleteTempError } = await supabase.storage
      .from('videos')
      .remove(tempFiles);

    if (deleteTempError) {
      console.error('Error deleting temp files (non-fatal):', deleteTempError);
    } else {
      console.log('✓ Temporary batch files cleaned up');
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
