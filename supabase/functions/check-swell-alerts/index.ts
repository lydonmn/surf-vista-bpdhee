import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isValidExpoToken(token: string | null | undefined): boolean {
  return !!token && token.startsWith('ExponentPushToken[');
}

async function sendPush(messages: object[]) {
  if (messages.length === 0) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[SwellAlerts] Push send error:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const locationId: string = body.location;
    const waveHeightRaw: string = String(body.wave_height || '').trim();

    if (!locationId || !waveHeightRaw) {
      return new Response(JSON.stringify({ success: false, error: 'Missing location or wave_height' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse wave height — use HIGH end of ranges like "3-4"
    let waveHeightNum = 0;
    if (waveHeightRaw.includes('-')) {
      const parts = waveHeightRaw.split('-');
      const high = parseFloat(parts[parts.length - 1].replace(/[^0-9.]/g, ''));
      waveHeightNum = isNaN(high) ? 0 : high;
    } else {
      waveHeightNum = parseFloat(waveHeightRaw.replace(/[^0-9.]/g, '')) || 0;
    }

    if (waveHeightNum === 0) {
      console.log(`[SwellAlerts] No valid wave height for ${locationId} — skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SwellAlerts] Checking ${locationId} — wave height: ${waveHeightNum}ft`);

    // Get today's date in EST
    const now = new Date();
    const estStr = now.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const [m, d, y] = estStr.split('/');
    const today = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

    // Fetch location display name
    const { data: locationRow } = await supabase
      .from('locations')
      .select('display_name')
      .eq('id', locationId)
      .maybeSingle();
    const locationName = locationRow?.display_name || locationId.replace(/-/g, ' ');

    // Fetch all users with a swell alert threshold and valid push token
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, push_token, min_wave_height')
      .not('min_wave_height', 'is', null)
      .not('push_token', 'is', null);

    if (profilesError) {
      console.error('[SwellAlerts] Error fetching profiles:', profilesError.message);
      return new Response(JSON.stringify({ success: false, error: profilesError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eligibleProfiles = (profiles || []).filter(p =>
      isValidExpoToken(p.push_token) &&
      p.min_wave_height !== null &&
      p.min_wave_height !== undefined
    );

    console.log(`[SwellAlerts] ${eligibleProfiles.length} users have swell thresholds set`);

    const riseMessages: object[] = [];
    const dropMessages: object[] = [];
    let riseCount = 0;
    let dropCount = 0;

    for (const profile of eligibleProfiles) {
      const threshold = profile.min_wave_height as number;
      const isAbove = waveHeightNum >= threshold;

      // Fetch or create today's state for this user+location
      const { data: existingState } = await supabase
        .from('swell_alert_state')
        .select('*')
        .eq('user_id', profile.id)
        .eq('location_id', locationId)
        .eq('alert_date', today)
        .maybeSingle();

      const wasAbove = existingState?.above_threshold ?? false;
      const riseNotifSent = existingState?.rise_notif_sent ?? false;
      const dropNotifSent = existingState?.drop_notif_sent ?? false;

      // CASE 1: Waves just crossed ABOVE threshold — send rise alert (once per day)
      if (isAbove && !riseNotifSent) {
        console.log(`[SwellAlerts] 🌊 RISE alert for ${profile.email} — ${waveHeightNum}ft >= ${threshold}ft`);
        riseMessages.push({
          to: profile.push_token,
          sound: 'default',
          title: '🌊 Swell Alert — Waves Are Up!',
          subtitle: locationName,
          body: `${waveHeightRaw}ft waves at ${locationName} have reached your ${threshold}ft threshold. Get out there!`,
          data: { type: 'swell_alert', location: locationId, waveHeight: waveHeightNum, alertKind: 'rise' },
          priority: 'high',
          channelId: 'swell-alerts',
          mutableContent: true,
        });
        riseCount++;

        // Upsert state — mark rise sent, above threshold
        await supabase.from('swell_alert_state').upsert({
          user_id: profile.id,
          location_id: locationId,
          alert_date: today,
          above_threshold: true,
          rise_notif_sent: true,
          drop_notif_sent: false,
          last_wave_height: waveHeightNum,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,location_id,alert_date' });
      }

      // CASE 2: Waves just dropped BELOW threshold after being above — send drop alert (once per day)
      else if (!isAbove && wasAbove && riseNotifSent && !dropNotifSent) {
        console.log(`[SwellAlerts] 📉 DROP alert for ${profile.email} — ${waveHeightNum}ft < ${threshold}ft`);
        dropMessages.push({
          to: profile.push_token,
          sound: 'default',
          title: '📉 Swell Update — Waves Have Dropped',
          subtitle: locationName,
          body: `Waves at ${locationName} have dropped to ${waveHeightRaw}ft, below your ${threshold}ft threshold.`,
          data: { type: 'swell_alert', location: locationId, waveHeight: waveHeightNum, alertKind: 'drop' },
          priority: 'normal',
          channelId: 'swell-alerts',
          mutableContent: true,
        });
        dropCount++;

        // Update state — mark drop sent, below threshold
        await supabase.from('swell_alert_state').upsert({
          user_id: profile.id,
          location_id: locationId,
          alert_date: today,
          above_threshold: false,
          rise_notif_sent: true,
          drop_notif_sent: true,
          last_wave_height: waveHeightNum,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,location_id,alert_date' });
      }

      // CASE 3: No state change — just update the last_wave_height
      else if (existingState) {
        await supabase.from('swell_alert_state')
          .update({ above_threshold: isAbove, last_wave_height: waveHeightNum, updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
          .eq('location_id', locationId)
          .eq('alert_date', today);
      } else {
        // First check of the day — create state row, no notification
        await supabase.from('swell_alert_state').insert({
          user_id: profile.id,
          location_id: locationId,
          alert_date: today,
          above_threshold: isAbove,
          rise_notif_sent: false,
          drop_notif_sent: false,
          last_wave_height: waveHeightNum,
        });
      }
    }

    // Send all notifications
    await sendPush(riseMessages);
    await sendPush(dropMessages);

    console.log(`[SwellAlerts] Done — rise alerts: ${riseCount}, drop alerts: ${dropCount}`);

    return new Response(JSON.stringify({
      success: true,
      location: locationId,
      waveHeight: waveHeightNum,
      riseAlertsSent: riseCount,
      dropAlertsSent: dropCount,
      usersChecked: eligibleProfiles.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[SwellAlerts] Fatal error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
