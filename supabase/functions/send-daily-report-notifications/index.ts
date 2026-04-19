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

async function sendExpoBatch(messages: object[]): Promise<{ successCount: number; failureCount: number }> {
  let successCount = 0;
  let failureCount = 0;
  const batchSize = 100;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      const result = await response.json();
      if (result.data) {
        for (const item of result.data) {
          if (item.status === 'ok') successCount++;
          else { failureCount++; console.error('[Notifications] Push failed:', JSON.stringify(item)); }
        }
      }
    } catch (err) {
      console.error('[Notifications] Batch send error:', err);
      failureCount += batch.length;
    }
  }
  return { successCount, failureCount };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const locationId: string = body.location || 'folly-beach';
    const reportDate: string = body.date;

    console.log('[Notifications] Starting for location:', locationId, 'date:', reportDate);

    // Fetch the surf report
    const { data: report, error: reportError } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', reportDate)
      .eq('location', locationId)
      .single();

    if (reportError || !report) {
      console.error('[Notifications] Report not found:', reportError);
      return new Response(JSON.stringify({ success: false, error: 'Report not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch location display name
    const { data: locationRow } = await supabase
      .from('locations')
      .select('display_name')
      .eq('id', locationId)
      .single();
    const locationName = locationRow?.display_name || locationId;

    // Parse wave height as a number for swell alert comparisons
    const waveHeightRaw: string = report.wave_height || '0';
    const waveHeightNum = parseFloat(waveHeightRaw.replace(/[^0-9.]/g, '')) || 0;

    // Fetch ALL profiles
    const { data: allProfiles, error: usersError } = await supabase
      .from('profiles')
      .select('id, push_token, email, is_admin, daily_report_notifications, min_wave_height');

    if (usersError) {
      console.error('[Notifications] Error fetching users:', usersError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch users' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allUsers = allProfiles || [];
    console.log(`[Notifications] Total profiles: ${allUsers.length}`);

    // Admin token audit
    for (const user of allUsers) {
      if (user.is_admin && !isValidExpoToken(user.push_token)) {
        console.warn(`[Notifications] ⚠️ ADMIN USER HAS NO VALID PUSH TOKEN: ${user.email} (id: ${user.id}) — token: ${user.push_token ?? 'null'}`);
      }
    }

    // Fetch notification_preferences for this specific location
    const { data: locationPrefs } = await supabase
      .from('notification_preferences')
      .select('user_id, enabled')
      .eq('location_id', locationId);

    const prefMapForLocation = new Map<string, boolean>();
    if (locationPrefs) {
      for (const pref of locationPrefs) {
        prefMapForLocation.set(pref.user_id, pref.enabled);
      }
    }

    // Fetch all user_ids that have ANY notification_preferences rows
    const { data: allPrefsRows } = await supabase
      .from('notification_preferences')
      .select('user_id');
    const usersWithAnyPrefs = new Set((allPrefsRows || []).map((r: any) => r.user_id));

    // Build daily report notification list
    const dailyReportUsers = allUsers.filter(user => {
      if (!user.daily_report_notifications) return false;
      if (!isValidExpoToken(user.push_token)) {
        console.log(`[Notifications] Skipping ${user.email} (daily): no valid token`);
        return false;
      }
      // Never configured → fallback: send for all locations
      if (!usersWithAnyPrefs.has(user.id)) {
        console.log(`[Notifications] ${user.email}: no prefs configured, sending via fallback`);
        return true;
      }
      const enabledForLocation = prefMapForLocation.get(user.id);
      if (enabledForLocation === true) {
        console.log(`[Notifications] ${user.email}: enabled for ${locationId}`);
        return true;
      }
      console.log(`[Notifications] ${user.email}: not subscribed to ${locationId}, skipping`);
      return false;
    });

    const rating = report.rating || 0;
    const ratingEmoji = rating >= 8 ? '🔥' : rating >= 6 ? '👍' : rating >= 4 ? '🌊' : '😐';
    const conditions = report.conditions || "Check the app for today's surf report!";
    const summary = conditions.length > 100 ? conditions.substring(0, 100) + '...' : conditions;
    const notifTitle = `${ratingEmoji} ${locationName} Surf Report`;
    const notifBody = `${waveHeightRaw} waves • ${rating}/10 rating\n${summary}`;

    const dailyMessages = dailyReportUsers.map(user => ({
      to: user.push_token,
      sound: 'default',
      title: notifTitle,
      body: notifBody,
      data: { type: 'daily_report', reportId: report.id, location: locationId, date: reportDate },
      priority: 'high',
      channelId: 'daily-reports',
    }));

    console.log(`[Notifications] Sending daily report to ${dailyMessages.length} users`);
    const dailyResult = dailyMessages.length > 0
      ? await sendExpoBatch(dailyMessages)
      : { successCount: 0, failureCount: 0 };

    // Swell alert notifications
    const swellAlertUsers = allUsers.filter(user => {
      if (user.min_wave_height === null || user.min_wave_height === undefined) return false;
      if (!isValidExpoToken(user.push_token)) return false;
      const meets = waveHeightNum >= user.min_wave_height;
      if (meets) console.log(`[Notifications] ${user.email}: swell alert (${waveHeightNum}ft >= ${user.min_wave_height}ft threshold)`);
      return meets;
    });

    const swellMessages = swellAlertUsers.map(user => ({
      to: user.push_token,
      sound: 'default',
      title: '🌊 Swell Alert',
      body: `${waveHeightNum}ft waves at ${locationName} right now!`,
      data: { type: 'swell_alert', location: locationId, waveHeight: waveHeightNum },
      priority: 'high',
      channelId: 'swell-alerts',
    }));

    console.log(`[Notifications] Swell check: ${waveHeightNum}ft — ${swellAlertUsers.length} users meet threshold`);
    const swellResult = swellMessages.length > 0
      ? await sendExpoBatch(swellMessages)
      : { successCount: 0, failureCount: 0 };

    return new Response(JSON.stringify({
      success: true,
      dailyReport: { sent: dailyResult.successCount, failed: dailyResult.failureCount, eligible: dailyReportUsers.length },
      swellAlerts: { sent: swellResult.successCount, failed: swellResult.failureCount, eligible: swellAlertUsers.length, waveHeight: waveHeightNum },
      totalProfiles: allUsers.length,
      totalOptedIn: allUsers.filter(u => u.daily_report_notifications).length,
      location: locationName,
      date: reportDate,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Notifications] Fatal error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
