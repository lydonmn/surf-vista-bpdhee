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

    // Fix 3: Test mode — skip report lookup and send a test notification to all eligible users
    if (body.test === true) {
      console.log('[Notifications] 🧪 TEST MODE — skipping report lookup', body.email ? `(filtered to email: ${body.email})` : '(all eligible users)');

      let query = supabase.from('profiles').select('push_token, email').not('push_token', 'is', null);
      if (body.email) {
        query = query.eq('email', body.email);
      }
      const { data: testProfiles, error: testUsersError } = await query;

      if (testUsersError) {
        console.error('[Notifications] Test mode: error fetching users:', testUsersError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch users' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const eligibleTestUsers = (testProfiles || []).filter(u => isValidExpoToken(u.push_token));
      console.log(`[Notifications] Test mode: sending to ${eligibleTestUsers.length} users with valid tokens`);

      const testMessages = eligibleTestUsers.map(user => ({
        to: user.push_token,
        sound: 'default',
        title: '🧪 Test Notification',
        body: 'Push notifications are working correctly!',
        data: { type: 'test' },
        priority: 'high',
      }));

      const testResult = testMessages.length > 0
        ? await sendExpoBatch(testMessages)
        : { successCount: 0, failureCount: 0 };

      console.log(`[Notifications] Test mode complete: ${testResult.successCount} sent, ${testResult.failureCount} failed`);

      return new Response(JSON.stringify({
        success: true,
        test: true,
        sent: testResult.successCount,
        failed: testResult.failureCount,
        eligible: eligibleTestUsers.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fix 1: Resilient report lookup — try by date first, fall back to most recent today
    let report: any = null;

    // Attempt 1: exact date match
    const { data: reportByDate, error: reportByDateError } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', reportDate)
      .eq('location', locationId)
      .single();

    if (reportByDate) {
      console.log('[Notifications] ✅ Report found by date match:', reportDate);
      report = reportByDate;
    } else {
      console.warn('[Notifications] ⚠️ Report not found by date:', reportDate, '— error:', reportByDateError?.message);
      console.log('[Notifications] 🔄 Falling back to most recent report created today...');

      // Attempt 2: most recent report for this location created today (UTC)
      const todayStartUTC = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
      const { data: reportByCreatedAt, error: reportByCreatedAtError } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('location', locationId)
        .gte('created_at', todayStartUTC)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reportByCreatedAt) {
        console.log('[Notifications] ✅ Report found via created_at fallback (created_at:', reportByCreatedAt.created_at, ')');
        report = reportByCreatedAt;
      } else {
        console.error('[Notifications] ❌ No report found after both attempts. created_at fallback error:', reportByCreatedAtError?.message);
        return new Response(JSON.stringify({ success: false, error: 'Report not found after date and created_at fallback' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch location display name
    const { data: locationRow } = await supabase
      .from('locations')
      .select('display_name')
      .eq('id', locationId)
      .single();
    const locationName = locationRow?.display_name || locationId;

    // Read wave height from surf_height OR wave_height (whichever is populated)
    const rawHeightField = report.surf_height || report.wave_height || '';
    const waveHeightRaw: string = rawHeightField ? String(rawHeightField).trim() : '';

    // Parse wave height — handle ranges like "3-4" by using the HIGH end for swell alert comparison
    let waveHeightNum = 0;
    if (waveHeightRaw.includes('-')) {
      const parts = waveHeightRaw.split('-');
      const high = parseFloat(parts[parts.length - 1].replace(/[^0-9.]/g, ''));
      waveHeightNum = isNaN(high) ? 0 : high;
    } else {
      waveHeightNum = parseFloat(waveHeightRaw.replace(/[^0-9.]/g, '')) || 0;
    }

    console.log(`[Notifications] Wave height raw: "${waveHeightRaw}" → parsed high: ${waveHeightNum}ft`);

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

    const rating = Number(report.rating) || 0;
    const ratingEmoji = rating >= 8 ? '🔥' : rating >= 6 ? '👍' : rating >= 4 ? '🌊' : '😐';

    // Title — short, fits on one line
    const notifTitle = `${ratingEmoji} ${locationName} Surf Report`;

    // Subtitle — wave height + stoke rating, always visible
    const waveDisplay = waveHeightRaw.length > 0 ? `${waveHeightRaw} ft waves` : 'Waves: N/A';
    const ratingDisplay = rating > 0 ? `${rating}/10 stoke` : '';
    const notifSubtitle = [waveDisplay, ratingDisplay].filter(Boolean).join(' · ');

    // Fetch next tide events for this location/date — wrapped so failure never blocks notifications
    const tideDate = report.date || reportDate;
    let tides: any[] = [];
    try {
      const { data: tidesData, error: tideError } = await supabase
        .from('tide_data')
        .select('time, type, height')
        .eq('location', locationId)
        .eq('date', tideDate)
        .order('time', { ascending: true })
        .limit(4);

      if (tideError) {
        console.warn('[Notifications] Tide fetch query error (non-fatal):', tideError.message);
      } else {
        console.log(`[Notifications] Tide data for ${locationId} on ${tideDate}:`, tidesData ? tidesData.length : 0, 'entries');
        tides = tidesData || [];
      }
    } catch (tideErr) {
      console.warn('[Notifications] Tide fetch threw (non-fatal), continuing without tides:', tideErr);
    }

    // Body — tide line + first sentence always visible; full narrative behind Force Touch
    const rawNarrative = String(report.conditions || report.detailed_forecast || '').trim();

    const tideSummaryParts: string[] = [];
    for (const t of tides.slice(0, 2)) {
      const typeLabel = String(t.type).toLowerCase() === 'high' ? '📈 High' : '📉 Low';
      const heightStr = t.height != null ? ` (${t.height}ft)` : '';
      const timeStr = t.time ? String(t.time).substring(0, 5) : '';
      tideSummaryParts.push(`${typeLabel} ${timeStr}${heightStr}`);
    }

    // Tide compact line — always shown
    const tideLine = tideSummaryParts.length > 0 ? tideSummaryParts.join(' · ') : '';

    // First sentence for the body summary
    const firstSentence = rawNarrative.split(/(?<=[.!?])\s/)[0]?.trim() ?? '';
    const summaryLine = firstSentence.length > 0
      ? (firstSentence.endsWith('.') || firstSentence.endsWith('!') || firstSentence.endsWith('?') ? firstSentence : firstSentence + '.')
      : '';

    // Body = tide line + summary sentence (always visible)
    // Then full narrative appended after — iOS hides the overflow and shows expand chevron on Force Touch
    const bodyVisible = [tideLine, summaryLine].filter(Boolean).join('\n');

    // Full narrative for Force Touch expansion (append after visible content)
    const fullNarrative = rawNarrative.length > 0 ? rawNarrative : '';
    const notifBody = fullNarrative.length > summaryLine.length + 20
      ? `${bodyVisible}\n\n${fullNarrative}`
      : bodyVisible;

    // Full report for data payload (used by "Full Report" action button)
    const fullReport = rawNarrative.length > 0 ? rawNarrative.substring(0, 500) : 'Open the app for the full report.';

    console.log(`[Notifications] Notification body (${notifBody.length} chars):`, notifBody.substring(0, 100));

    const dailyMessages = dailyReportUsers.map(user => ({
      to: user.push_token,
      sound: 'default',
      title: notifTitle,
      subtitle: notifSubtitle,
      body: notifBody,
      data: {
        type: 'daily_report',
        reportId: report.id,
        location: locationId,
        locationName: locationName,
        date: reportDate,
        fullReport: fullReport,
        waveHeight: waveDisplay,
        rating: rating,
      },
      priority: 'high',
      channelId: 'daily-reports',
      categoryId: 'DAILY_REPORT',
      mutableContent: true,
      contentAvailable: true,
    }));

    console.log(`[Notifications] Sending daily report to ${dailyMessages.length} users`);
    const dailyResult = dailyMessages.length > 0
      ? await sendExpoBatch(dailyMessages)
      : { successCount: 0, failureCount: 0 };

    return new Response(JSON.stringify({
      success: true,
      dailyReport: { sent: dailyResult.successCount, failed: dailyResult.failureCount, eligible: dailyReportUsers.length },
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
