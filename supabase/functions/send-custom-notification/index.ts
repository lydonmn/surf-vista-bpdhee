import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  title: string;
  body: string;
  audience: 'all' | 'subscribers' | 'specific';
  userIds?: string[];
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { title, body: messageBody, audience, userIds } = body;

    console.log('[send-custom-notification] Request received:', { title, audience, userIds });

    if (!title || !messageBody || !audience) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: title, body, audience' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query based on audience
    let query = supabase
      .from('profiles')
      .select('id, push_token')
      .like('push_token', 'ExponentPushToken[%');

    if (audience === 'subscribers') {
      query = query.eq('is_subscribed', true);
    } else if (audience === 'specific') {
      if (!userIds || userIds.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'userIds required for specific audience' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      query = query.in('id', userIds);
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error('[send-custom-notification] Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ success: false, error: profilesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validTokens = (profiles ?? [])
      .map((p) => p.push_token as string)
      .filter((t) => t && t.startsWith('ExponentPushToken['));

    console.log('[send-custom-notification] Eligible recipients:', validTokens.length);

    if (validTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, audience, recipientCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send in batches of 100
    const BATCH_SIZE = 100;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      const batch = validTokens.slice(i, i + BATCH_SIZE);
      const messages: ExpoPushMessage[] = batch.map((token) => ({
        to: token,
        title,
        body: messageBody,
        sound: 'default',
        data: { type: 'custom_notification' },
      }));

      console.log(`[send-custom-notification] Sending batch ${Math.floor(i / BATCH_SIZE) + 1} (${messages.length} messages)`);

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[send-custom-notification] Expo API error:', response.status, errText);
        totalFailed += batch.length;
        continue;
      }

      const result = await response.json();
      console.log('[send-custom-notification] Expo API response:', JSON.stringify(result));

      if (result.data && Array.isArray(result.data)) {
        for (const ticket of result.data) {
          if (ticket.status === 'ok') {
            totalSent++;
          } else {
            totalFailed++;
            console.warn('[send-custom-notification] Ticket error:', ticket.message, ticket.details);
          }
        }
      } else {
        totalSent += batch.length;
      }
    }

    console.log(`[send-custom-notification] Done — sent: ${totalSent}, failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        failed: totalFailed,
        audience,
        recipientCount: validTokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-custom-notification] Unexpected error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
