
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Send Daily Notifications] ═══════════════════════════════════════');
    console.log('[Send Daily Notifications] 📲 SENDING DAILY REPORT NOTIFICATIONS');
    console.log('[Send Daily Notifications] ═══════════════════════════════════════');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body to get location and report data
    const body = await req.json();
    const locationId = body.location || 'folly-beach';
    const reportDate = body.date;

    console.log('[Send Daily Notifications] Location:', locationId);
    console.log('[Send Daily Notifications] Date:', reportDate);

    // Fetch the generated report
    const { data: report, error: reportError } = await supabase
      .from('surf_reports')
      .select('*')
      .eq('date', reportDate)
      .eq('location', locationId)
      .single();

    if (reportError || !report) {
      console.error('[Send Daily Notifications] Report not found:', reportError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Report not found',
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch location details
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('display_name')
      .eq('id', locationId)
      .single();

    const locationName = location?.display_name || 'Folly Beach, SC';

    // Fetch ALL users who have opted in for daily notifications
    // We'll check their notification_locations and push_token separately
    const { data: allOptedInUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, push_token, email, notification_locations, is_admin')
      .eq('daily_report_notifications', true);

    if (usersError) {
      console.error('[Send Daily Notifications] Error fetching users:', usersError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch users',
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!allOptedInUsers || allOptedInUsers.length === 0) {
      console.log('[Send Daily Notifications] No users opted in for notifications');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users to notify',
          notificationsSent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Send Daily Notifications] Found ${allOptedInUsers.length} users with notifications enabled`);

    // Filter users who:
    // 1. Have a valid push token
    // 2. Have this location in their notification_locations array (or have no locations set, defaulting to all)
    const eligibleUsers = allOptedInUsers.filter(user => {
      // Check if user has a push token
      if (!user.push_token || user.push_token === 'web-dummy-token' || user.push_token === 'simulator-dummy-token') {
        console.log(`[Send Daily Notifications] ⚠️ User ${user.email} has no valid push token - skipping`);
        return false;
      }

      // Check if user wants notifications for this location
      const userLocations = user.notification_locations || ['folly-beach'];
      const wantsThisLocation = userLocations.includes(locationId);
      
      if (!wantsThisLocation) {
        console.log(`[Send Daily Notifications] ℹ️ User ${user.email} not subscribed to ${locationId} - skipping`);
        return false;
      }

      console.log(`[Send Daily Notifications] ✅ User ${user.email} eligible for ${locationId} notification`);
      return true;
    });

    if (eligibleUsers.length === 0) {
      console.log('[Send Daily Notifications] ⚠️ No eligible users with valid push tokens for this location');
      console.log('[Send Daily Notifications] Users without tokens:', 
        allOptedInUsers.filter(u => !u.push_token || u.push_token === 'web-dummy-token' || u.push_token === 'simulator-dummy-token')
          .map(u => u.email).join(', ')
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No eligible users with valid push tokens',
          notificationsSent: 0,
          usersWithoutTokens: allOptedInUsers.filter(u => !u.push_token || u.push_token === 'web-dummy-token' || u.push_token === 'simulator-dummy-token').length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Send Daily Notifications] Sending to ${eligibleUsers.length} eligible users`);

    // Create notification summary from report
    const waveHeight = report.wave_height || 'N/A';
    const rating = report.rating || 0;
    const ratingEmoji = rating >= 8 ? '🔥' : rating >= 6 ? '👍' : rating >= 4 ? '🌊' : '😐';
    
    // Create a short summary (first 100 chars of conditions)
    const fullConditions = report.conditions || 'Check the app for today\'s surf report!';
    const summary = fullConditions.length > 100 
      ? fullConditions.substring(0, 100) + '...' 
      : fullConditions;

    const notificationTitle = `${ratingEmoji} ${locationName} Surf Report`;
    const notificationBody = `${waveHeight} waves • ${rating}/10 rating\n${summary}`;

    // Send push notifications using Expo Push API
    const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
    const messages = eligibleUsers.map(user => ({
      to: user.push_token,
      sound: 'default',
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: 'daily_report',
        reportId: report.id,
        location: locationId,
        date: reportDate,
      },
      priority: 'high',
      channelId: 'daily-reports',
    }));

    console.log(`[Send Daily Notifications] Sending ${messages.length} notifications...`);

    const notificationResults = [];
    let successCount = 0;
    let failureCount = 0;

    // Send notifications in batches of 100 (Expo's limit)
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      try {
        const response = await fetch(expoPushUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        const result = await response.json();
        notificationResults.push(result);

        // Count successes and failures
        if (result.data) {
          for (const item of result.data) {
            if (item.status === 'ok') {
              successCount++;
            } else {
              failureCount++;
              console.error('[Send Daily Notifications] Failed to send to:', item.details?.error);
            }
          }
        }
      } catch (error) {
        console.error('[Send Daily Notifications] Batch send error:', error);
        failureCount += batch.length;
      }
    }

    console.log('[Send Daily Notifications] ═══════════════════════════════════════');
    console.log(`[Send Daily Notifications] ✅ Sent: ${successCount}`);
    console.log(`[Send Daily Notifications] ❌ Failed: ${failureCount}`);
    console.log(`[Send Daily Notifications] 📊 Total opted-in users: ${allOptedInUsers.length}`);
    console.log(`[Send Daily Notifications] 📊 Eligible users (with tokens): ${eligibleUsers.length}`);
    console.log(`[Send Daily Notifications] 📊 Users without tokens: ${allOptedInUsers.length - eligibleUsers.length}`);
    console.log('[Send Daily Notifications] ═══════════════════════════════════════');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${successCount} users`,
        notificationsSent: successCount,
        notificationsFailed: failureCount,
        totalOptedIn: allOptedInUsers.length,
        eligibleUsers: eligibleUsers.length,
        usersWithoutTokens: allOptedInUsers.length - eligibleUsers.length,
        location: locationName,
        date: reportDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Send Daily Notifications] 💥 Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
