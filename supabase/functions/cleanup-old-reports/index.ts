
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date in EST timezone
    const estDate = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York' 
    });
    const today = new Date(estDate).toISOString().split('T')[0];
    
    console.log('Cleanup running for EST date:', today);
    console.log('Current EST time:', estDate);

    // Delete all surf reports that are not from today
    const { data: deletedReports, error: deleteError } = await supabase
      .from('surf_reports')
      .delete()
      .neq('date', today)
      .select();

    if (deleteError) {
      console.error('Error deleting old reports:', deleteError);
      throw deleteError;
    }

    console.log(`Deleted ${deletedReports?.length || 0} old reports`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${deletedReports?.length || 0} old reports`,
        date: today,
        deletedReports: deletedReports?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup-old-reports:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
