import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await supabase
      .from('survey_responses')
      .select('id, user_id, device_id, how_found, surf_location, improvement, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const howFoundMap: Record<string, number> = {};
    for (const row of rows) {
      if (row.how_found) howFoundMap[row.how_found] = (howFoundMap[row.how_found] ?? 0) + 1;
    }
    const how_found = Object.entries(howFoundMap).map(([answer, count]) => ({ answer, count })).sort((a, b) => b.count - a.count);
    return new Response(JSON.stringify({
      total: rows.length,
      how_found,
      surf_locations: rows.map((r: any) => r.surf_location).filter(Boolean),
      improvements: rows.map((r: any) => r.improvement).filter(Boolean),
      responses: rows.map((r: any) => ({ created_at: r.created_at, how_found: r.how_found, surf_location: r.surf_location, improvement: r.improvement })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
