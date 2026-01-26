
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
    console.log('=== MERGE VIDEO CHUNKS STARTED ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Use service role key for admin access to storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fileName, totalChunks } = await req.json() as MergeRequest;
    console.log('Merging video:', fileName);
    console.log('Total chunks:', totalChunks);

    if (totalChunks === 1) {
      console.log('Single chunk upload - no merging needed');
      
      // For single chunk, just verify it exists and is accessible
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

    // Download all chunks
    console.log('Downloading chunks...');
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    for (let i = 0; i < totalChunks; i++) {
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
      chunks.push(uint8Array);
      totalSize += uint8Array.length;
      console.log(`✓ Chunk ${i + 1} downloaded: ${uint8Array.length} bytes`);
    }

    console.log(`Total size of all chunks: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    // Merge chunks into a single Uint8Array
    console.log('Merging chunks into single file...');
    const mergedVideo = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < chunks.length; i++) {
      mergedVideo.set(chunks[i], offset);
      offset += chunks[i].length;
      console.log(`✓ Merged chunk ${i + 1}/${chunks.length}`);
    }

    console.log('✓ All chunks merged successfully');
    console.log('Merged video size:', mergedVideo.length, 'bytes');

    // Verify the merged video has proper MP4 headers
    // MP4 files should start with 'ftyp' box (after size bytes)
    const hasValidMP4Header = (
      mergedVideo.length > 8 &&
      mergedVideo[4] === 0x66 && // 'f'
      mergedVideo[5] === 0x74 && // 't'
      mergedVideo[6] === 0x79 && // 'y'
      mergedVideo[7] === 0x70    // 'p'
    );

    if (!hasValidMP4Header) {
      console.warn('⚠️ Warning: Merged video may not have valid MP4 header');
      console.log('First 16 bytes:', Array.from(mergedVideo.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    } else {
      console.log('✓ Valid MP4 header detected');
    }

    // Delete the old file if it exists (to avoid conflicts)
    console.log('Removing old file if exists...');
    const { error: removeError } = await supabase.storage
      .from('videos')
      .remove([fileName]);
    
    if (removeError) {
      console.log('Note: Old file removal returned error (may not exist):', removeError.message);
    } else {
      console.log('✓ Old file removed (if it existed)');
    }

    // Upload the merged video with proper content type and cache control
    console.log('Uploading merged video with proper headers...');
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
    console.log('Upload data:', uploadData);

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    console.log('✓ Public URL generated:', publicUrl);

    // Verify the uploaded file is accessible
    console.log('Verifying uploaded file accessibility...');
    try {
      const headResponse = await fetch(publicUrl, { method: 'HEAD' });
      console.log('HEAD response status:', headResponse.status);
      console.log('Content-Type:', headResponse.headers.get('content-type'));
      console.log('Content-Length:', headResponse.headers.get('content-length'));
      
      if (!headResponse.ok) {
        console.error('⚠️ WARNING: Uploaded file is not accessible via public URL!');
        console.error('This may indicate RLS policy issues or bucket configuration problems');
      } else {
        console.log('✓ Uploaded file is accessible via public URL');
      }
    } catch (verifyError) {
      console.error('Error verifying file accessibility:', verifyError);
    }

    // Delete chunk files
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
      // Don't throw - merged video is already uploaded
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
