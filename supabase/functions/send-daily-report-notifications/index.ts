
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

    // ✅ V6.9 FIX: Fetch ALL users who have opted in for daily notifications with detailed logging
    console.log('[Send Daily Notifications] ===== FETCHING USERS =====');
    const { data: allOptedInUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, push_token, email, notification_locations, is_admin, daily_report_notifications')
      .eq('daily_report_notifications', true);

    if (usersError) {
      console.error('[Send Daily Notifications] ❌ Error fetching users:', usersError);
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
      console.log('[Send Daily Notifications] ⚠️ No users opted in for notifications');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users to notify',
          notificationsSent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Send Daily Notifications] ===== USER ANALYSIS =====`);
    console.log(`[Send Daily Notifications] Total users with notifications enabled: ${allOptedInUsers.length}`);
    
    // ✅ V6.9 FIX: Detailed logging for each user
    allOptedInUsers.forEach((user, index) => {
      console.log(`[Send Daily Notifications] User ${index + 1}/${allOptedInUsers.length}:`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Is Admin: ${user.is_admin}`);
      console.log(`  - Has Push Token: ${!!user.push_token}`);
      console.log(`  - Push Token Type: ${!user.push_token ? 'NONE' : user.push_token === 'web-dummy-token' ? 'WEB_DUMMY' : user.push_token === 'simulator-dummy-token' ? 'SIMULATOR_DUMMY' : 'VALID'}`);
      console.log(`  - Notification Locations: ${JSON.stringify(user.notification_locations || ['folly-beach'])}`);
      console.log(`  - Wants ${locationId}: ${(user.notification_locations || ['folly-beach']).includes(locationId)}`);
    });

    // Filter users who:
    // 1. Have a valid push token (not null, not dummy tokens)
    // 2. Have this location in their notification_locations array (or have no locations set, defaulting to all)
    const eligibleUsers = allOptedInUsers.filter(user => {
      // ✅ V6.9 FIX: Check if user has a VALID push token
      if (!user.push_token) {
        console.log(`[Send Daily Notifications] ⚠️ User ${user.email} has NO push token - SKIPPING`);
        console.log(`[Send Daily Notifications]    → User needs to: 1) Enable notifications in profile, 2) Grant permission, 3) App must be EAS build`);
        return false;
      }
      
      if (user.push_token === 'web-dummy-token') {
        console.log(`[Send Daily Notifications] ⚠️ User ${user.email} has WEB dummy token - SKIPPING`);
        return false;
      }
      
      if (user.push_token === 'simulator-dummy-token') {
        console.log(`[Send Daily Notifications] ⚠️ User ${user.email} has SIMULATOR dummy token - SKIPPING`);
        console.log(`[Send Daily Notifications]    → User needs to use a physical device or TestFlight build`);
        return false;
      }

      // Check if user wants notifications for this location
      const userLocations = user.notification_locations || ['folly-beach'];
      const wantsThisLocation = userLocations.includes(locationId);
      
      if (!wantsThisLocation) {
        console.log(`[Send Daily Notifications] ℹ️ User ${user.email} not subscribed to ${locationId} - SKIPPING`);
        return false;
      }

      console.log(`[Send Daily Notifications] ✅ User ${user.email} ELIGIBLE for ${locationId} notification`);
      console.log(`[Send Daily Notifications]    → Has valid token: ${user.push_token.substring(0, 20)}...`);
      return true;
    });

    console.log('[Send Daily Notifications] ===== ELIGIBILITY SUMMARY =====');
    console.log(`[Send Daily Notifications] Total opted-in users: ${allOptedInUsers.length}`);
    console.log(`[Send Daily Notifications] Eligible users (with valid tokens): ${eligibleUsers.length}`);
    console.log(`[Send Daily Notifications] Users without valid tokens: ${allOptedInUsers.length - eligibleUsers.length}`);

    if (eligibleUsers.length === 0) {
      const usersWithoutTokens = allOptedInUsers.filter(u => 
        !u.push_token || u.push_token === 'web-dummy-token' || u.push_token === 'simulator-dummy-token'
      );
      
      console.log('[Send Daily Notifications] ⚠️ NO ELIGIBLE USERS WITH VALID PUSH TOKENS');
      console.log('[Send Daily Notifications] ===== USERS WITHOUT VALID TOKENS =====');
      usersWithoutTokens.forEach(u => {
        console.log(`  - ${u.email}: ${!u.push_token ? 'NO TOKEN' : u.push_token}`);
      });
      console.log('[Send Daily Notifications] ===================================');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No eligible users with valid push tokens',
          notificationsSent: 0,
          totalOptedIn: allOptedInUsers.length,
          usersWithoutValidTokens: usersWithoutTokens.length,
          usersWithoutTokensDetails: usersWithoutTokens.map(u => ({
            email: u.email,
            isAdmin: u.is_admin,
            tokenStatus: !u.push_token ? 'NONE' : u.push_token === 'web-dummy-token' ? 'WEB_DUMMY' : 'SIMULATOR_DUMMY'
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Send Daily Notifications] ===== SENDING TO ${eligibleUsers.length} USERS =====`);
    eligibleUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.is_admin ? 'ADMIN' : 'USER'})`);
    });

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

    console.log('[Send Daily Notifications] ===== NOTIFICATION CONTENT =====');
    console.log('[Send Daily Notifications] Title:', notificationTitle);
    console.log('[Send Daily Notifications] Body:', notificationBody);

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

    console.log(`[Send Daily Notifications] ===== SENDING ${messages.length} NOTIFICATIONS =====`);

    const notificationResults = [];
    let successCount = 0;
    let failureCount = 0;
    const failedUsers: any[] = [];

    // Send notifications in batches of 100 (Expo's limit)
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchUsers = eligibleUsers.slice(i, i + batchSize);
      
      console.log(`[Send Daily Notifications] Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messages.length / batchSize)}...`);
      
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
          for (let j = 0; j < result.data.length; j++) {
            const item = result.data[j];
            const userEmail = batchUsers[j]?.email || 'unknown';
            
            if (item.status === 'ok') {
              successCount++;
              console.log(`[Send Daily Notifications] ✅ Sent to ${userEmail}`);
            } else {
              failureCount++;
              const errorDetails = item.details?.error || item.message || 'Unknown error';
              console.error(`[Send Daily Notifications] ❌ Failed to send to ${userEmail}: ${errorDetails}`);
              failedUsers.push({
                email: userEmail,
                error: errorDetails,
              });
            }
          }
        }
      } catch (error) {
        console.error('[Send Daily Notifications] ❌ Batch send error:', error);
        failureCount += batch.length;
        batch.forEach((msg, idx) => {
          failedUsers.push({
            email: batchUsers[idx]?.email || 'unknown',
            error: 'Batch send failed',
          });
        });
      }
    }

    console.log('[Send Daily Notifications] ═══════════════════════════════════════');
    console.log('[Send Daily Notifications] ===== FINAL RESULTS =====');
    console.log(`[Send Daily Notifications] ✅ Successfully sent: ${successCount}`);
    console.log(`[Send Daily Notifications] ❌ Failed: ${failureCount}`);
    console.log(`[Send Daily Notifications] 📊 Total opted-in users: ${allOptedInUsers.length}`);
    console.log(`[Send Daily Notifications] 📊 Eligible users (with valid tokens): ${eligibleUsers.length}`);
    console.log(`[Send Daily Notifications] 📊 Users without valid tokens: ${allOptedInUsers.length - eligibleUsers.length}`);
    
    if (failedUsers.length > 0) {
      console.log('[Send Daily Notifications] ===== FAILED USERS =====');
      failedUsers.forEach(u => {
        console.log(`  - ${u.email}: ${u.error}`);
      });
    }
    
    console.log('[Send Daily Notifications] ═══════════════════════════════════════');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${successCount} users`,
        notificationsSent: successCount,
        notificationsFailed: failureCount,
        totalOptedIn: allOptedInUsers.length,
        eligibleUsers: eligibleUsers.length,
        usersWithoutValidTokens: allOptedInUsers.length - eligibleUsers.length,
        failedUsers: failedUsers,
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
