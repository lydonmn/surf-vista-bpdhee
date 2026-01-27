
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
    console.log('=== MERGE VIDEO CHUNKS STARTED (ULTRA-OPTIMIZED STREAMING) ===');
    
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

    // MEMORY-EFFICIENT: Collect all chunks in memory, then merge once
    console.log('Using memory-efficient merge strategy...');
    
    let totalSize = 0;
    let hasValidMP4Header = false;
    const chunks: Uint8Array[] = [];

    // Step 1: Download all chunks into memory
    console.log('Step 1: Downloading all chunks...');
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileName}.part${i}`;
      console.log(`Downloading chunk ${i + 1}/${totalChunks}...`);
      
      // Download chunk
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
      const chunkSize = uint8Array.length;
      totalSize += chunkSize;
      
      console.log(`✓ Chunk ${i + 1} downloaded: ${chunkSize} bytes (${(chunkSize / 1024 / 1024).toFixed(2)} MB)`);

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
        } else {
          console.warn('⚠️ Warning: No valid MP4 header detected in first chunk');
          console.log('First 16 bytes:', Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        }
      }

      // Store chunk in memory
      chunks.push(uint8Array);
      
      // Log progress
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      console.log(`Progress: ${progress}% (${i + 1}/${totalChunks} chunks downloaded)`);
    }

    console.log(`Total size to merge: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    // Step 2: Merge all chunks into one array
    console.log('Step 2: Merging chunks in memory...');
    const mergedArray = new Uint8Array(totalSize);
    let offset = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      mergedArray.set(chunks[i], offset);
      offset += chunks[i].length;
      console.log(`Merged chunk ${i + 1}/${chunks.length} at offset ${offset}`);
    }
    
    console.log(`✓ All chunks merged into single array: ${mergedArray.length} bytes`);

    // Step 3: Upload merged file
    console.log('Step 3: Uploading merged video...');
    
    // Remove old final file if exists
    await supabase.storage.from('videos').remove([fileName]);

    // Upload as final file
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, mergedArray, {
        contentType: 'video/mp4',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Error uploading merged file:', uploadError);
      throw new Error(`Failed to upload merged file: ${uploadError.message}`);
    }

    console.log('✓ Merged video uploaded successfully');

    if (!hasValidMP4Header) {
      console.warn('⚠️ Warning: Merged video may not have valid MP4 header');
    }

    // Get public URL
    const publicUrlData = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);
    
    const publicUrl = publicUrlData.data.publicUrl;

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

    // Step 4: Clean up chunk files
    console.log('Step 4: Cleaning up chunk files...');
    
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
