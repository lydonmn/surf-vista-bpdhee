import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('BOOT', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth: verify caller is an authenticated admin ──────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse and validate request body ───────────────────────────────────
    const body = await req.json();
    const { target_user_id, duration_days } = body;

    if (!target_user_id || typeof target_user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'target_user_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const days = parseInt(duration_days);
    if (isNaN(days) || days < 1 || days > 365) {
      return new Response(JSON.stringify({ error: 'duration_days must be an integer between 1 and 365' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Call RevenueCat Grant Promotional Entitlement API ─────────────────
    // Entitlement ID: "pro" (from app.json revenueCatEntitlementId)
    // Secret name in Supabase Edge Function Secrets: "Extender V1" (case-sensitive, includes space)
    // Uses end_time_ms only — no X-Platform header (server-to-server call, not SDK)
    const rcSecretKey = Deno.env.get('Extender V1');
    console.log('RC key present:', !!rcSecretKey, 'length:', rcSecretKey?.length);
    if (!rcSecretKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing RC secret key (Extender V1)' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure subscriber exists in RC (GET auto-creates if not found)
    const rcGetUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(target_user_id)}`;
    console.log('GET RC subscriber:', rcGetUrl);
    const rcGetResponse = await fetch(rcGetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rcSecretKey}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('RC GET status:', rcGetResponse.status);

    const endTimeMs = Date.now() + days * 24 * 60 * 60 * 1000;
    const rcUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(target_user_id)}/entitlements/pro/promotional`;

    // Server-to-server request — NO X-Platform header (causes RC 403 client-detection error)
    const rcHeaders = {
      'Authorization': `Bearer ${rcSecretKey}`,
      'Content-Type': 'application/json',
    };
    const rcRequestBody = JSON.stringify({ end_time_ms: endTimeMs });

    console.log('POST RC grant URL:', rcUrl);
    console.log('RC request headers:', JSON.stringify(rcHeaders));
    console.log('RC request body:', rcRequestBody);

    const rcResponse = await fetch(rcUrl, {
      method: 'POST',
      headers: rcHeaders,
      body: rcRequestBody,
    });

    const rcBody = await rcResponse.json();
    console.log('RC response status:', rcResponse.status, 'body:', JSON.stringify(rcBody));

    if (!rcResponse.ok) {
      return new Response(
        JSON.stringify({ error: `RevenueCat API error (${rcResponse.status}): ${rcBody?.message || JSON.stringify(rcBody)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 4. RC confirmed success — now update local DB ────────────────────────
    const expiresAt = new Date(endTimeMs).toISOString();
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        is_subscribed: true,
        subscription_end_date: expiresAt,
        subscription_source: 'admin_grant',
      })
      .eq('id', target_user_id);

    if (dbError) {
      console.error('DB update failed after RC success:', dbError);
      return new Response(
        JSON.stringify({
          error: `RC grant succeeded but DB update failed: ${dbError.message}`,
          rc_response: rcBody,
          expires_at: expiresAt,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 5. Return success ─────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        entitlement: 'pro',
        expires_at: expiresAt,
        duration_days: days,
        rc_response: rcBody,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('Unexpected error:', err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
