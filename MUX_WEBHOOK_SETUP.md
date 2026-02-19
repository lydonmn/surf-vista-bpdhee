
# Mux Webhook Setup Guide

This guide explains how to set up Mux webhooks to automatically capture video URLs in the Supabase database when processing completes.

## Overview

The system now has **two ways** to capture Mux video URLs:

1. **Frontend Polling** (Current): The `useVideos` hook polls Mux every 15 seconds to check if videos are ready
2. **Mux Webhooks** (New): Mux automatically notifies our backend when videos are ready

**Webhooks are the recommended approach** because they're more efficient and reliable.

## Architecture

```
┌─────────────┐
│   Admin     │
│  Uploads    │
│   Video     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Mux Direct     │
│    Upload       │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐         ┌──────────────────┐
│  Mux Processes  │────────▶│  Mux Webhook     │
│     Video       │         │   (POST event)   │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Supabase Edge   │
                            │    Function      │
                            │  mux-webhook     │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   Update Video   │
                            │   Table with     │
                            │   video_url      │
                            └──────────────────┘
```

## Step 1: Deploy the Webhook Edge Function

The webhook handler has been created at `supabase/functions/mux-webhook/index.ts`.

To deploy it:

```bash
# Deploy the function
supabase functions deploy mux-webhook --no-verify-jwt

# The function will be available at:
# https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/mux-webhook
```

**Note**: We use `--no-verify-jwt` because Mux webhooks don't include JWT tokens. Instead, they use signature verification.

## Step 2: Configure Mux Webhook Secret (Optional but Recommended)

For security, Mux signs webhook requests. To verify these signatures:

1. Go to your Mux Dashboard → Settings → Webhooks
2. Create a new webhook (or view an existing one)
3. Copy the **Signing Secret**
4. Add it to your Supabase project:

```bash
# Set the environment variable
supabase secrets set MUX_WEBHOOK_SECRET=your_signing_secret_here
```

Or in the Supabase Dashboard:
- Go to Project Settings → Edge Functions
- Add environment variable: `MUX_WEBHOOK_SECRET` = `your_signing_secret`

## Step 3: Register the Webhook in Mux Dashboard

1. Go to [Mux Dashboard](https://dashboard.mux.com/)
2. Navigate to **Settings** → **Webhooks**
3. Click **Create New Webhook**
4. Configure:
   - **URL**: `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/mux-webhook`
   - **Events to subscribe to**:
     - ✅ `video.asset.ready` (CRITICAL - when video is ready to play)
     - ✅ `video.asset.errored` (when processing fails)
     - ✅ `video.upload.asset_created` (when upload completes and asset is created)
5. Click **Create Webhook**
6. Copy the **Signing Secret** and add it to Supabase (see Step 2)

## Step 4: Test the Webhook

### Test with a Real Upload

1. Upload a video through the admin panel
2. Watch the Supabase Edge Function logs:
   ```bash
   supabase functions logs mux-webhook --follow
   ```
3. You should see:
   ```
   [mux-webhook] 📥 Received webhook
   [mux-webhook] ✅ Signature verified
   [mux-webhook] 📊 Event type: video.asset.ready
   [mux-webhook] 🎬 Asset ready event
   [mux-webhook] Asset ID: abc123...
   [mux-webhook] Playback ID: xyz789...
   [mux-webhook] 🎥 HLS URL: https://stream.mux.com/xyz789.m3u8
   [mux-webhook] ✅ Video updated successfully: video-uuid
   ```

### Test with Mux Dashboard

1. In Mux Dashboard → Webhooks → Your Webhook
2. Click **Send Test Event**
3. Select `video.asset.ready`
4. Click **Send**
5. Check the logs to verify it was received

## How It Works

### When a Video is Uploaded

1. **Admin uploads video** → `app/admin.tsx`
2. **Create Mux upload** → `mux-create-upload` Edge Function
3. **Upload to Mux** → Direct upload via `FileSystem.uploadAsync`
4. **Save to database** with:
   - `mux_upload_id`: The upload ID from Mux
   - `status`: `'processing'`
   - `video_url`: Empty (will be filled by webhook)

### When Mux Finishes Processing

1. **Mux sends webhook** → `video.asset.ready` event
2. **Webhook handler receives** → `mux-webhook` Edge Function
3. **Verifies signature** (if `MUX_WEBHOOK_SECRET` is set)
4. **Extracts data**:
   - Asset ID
   - Playback ID
5. **Constructs HLS URL**: `https://stream.mux.com/{playbackId}.m3u8`
6. **Updates database**:
   ```sql
   UPDATE videos
   SET video_url = 'https://stream.mux.com/xyz789.m3u8',
       status = 'active',
       mux_asset_id = 'abc123',
       updated_at = NOW()
   WHERE mux_asset_id = 'abc123'
   ```
7. **Frontend automatically updates** via Supabase real-time subscriptions

### Webhook Events Handled

| Event | Description | Action |
|-------|-------------|--------|
| `video.upload.asset_created` | Upload completed, asset created | Link `mux_upload_id` to `mux_asset_id` |
| `video.asset.ready` | Video transcoded and ready | Set `video_url` and `status='active'` |
| `video.asset.errored` | Processing failed | Set `status='errored'` |

## Database Schema

The `videos` table has these Mux-related columns:

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,  -- HLS URL from Mux
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'processing', 'errored')),
  mux_upload_id TEXT,  -- Mux upload ID (from create-upload)
  mux_asset_id TEXT,   -- Mux asset ID (from webhook)
  -- ... other columns
);
```

## Troubleshooting

### Webhook Not Receiving Events

1. **Check Mux Dashboard**:
   - Go to Webhooks → Your Webhook → Recent Deliveries
   - Look for failed deliveries
   - Check the error message

2. **Check Edge Function Logs**:
   ```bash
   supabase functions logs mux-webhook --follow
   ```

3. **Verify URL**:
   - Make sure the webhook URL is correct
   - It should be: `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/mux-webhook`

### Signature Verification Failing

1. **Check Secret**:
   ```bash
   supabase secrets list
   ```
   - Verify `MUX_WEBHOOK_SECRET` is set

2. **Regenerate Secret**:
   - In Mux Dashboard, regenerate the signing secret
   - Update it in Supabase

3. **Temporarily Disable Verification** (for testing only):
   - Remove `MUX_WEBHOOK_SECRET` from Supabase
   - The webhook will still work but won't verify signatures

### Video Not Updating

1. **Check Database**:
   ```sql
   SELECT id, title, status, mux_upload_id, mux_asset_id, video_url
   FROM videos
   WHERE status = 'processing'
   ORDER BY created_at DESC;
   ```

2. **Check Mux Asset ID**:
   - The webhook matches videos by `mux_asset_id`
   - Make sure the `mux_asset_id` in the database matches the one in the webhook

3. **Check Logs**:
   - Look for "No matching video found" in the logs
   - This means the `mux_asset_id` doesn't match any video

## Frontend Polling (Fallback)

The frontend still polls for status updates as a fallback. This ensures videos are updated even if:
- Webhooks are not configured
- Webhook delivery fails
- There's a temporary network issue

The polling logic is in `hooks/useVideos.ts`:
- Polls every 15 seconds
- Maximum 15 minutes of polling
- Automatically stops when video is ready or errored

## Benefits of Webhooks

1. **Instant Updates**: No waiting for polling interval
2. **Reduced Load**: No constant polling requests
3. **More Reliable**: Mux guarantees delivery with retries
4. **Better UX**: Users see videos become available immediately
5. **Scalable**: Works for any number of videos without increasing load

## Security

The webhook handler includes several security measures:

1. **Signature Verification**: Verifies requests are from Mux
2. **Service Role Key**: Uses Supabase service role for database access
3. **No JWT Required**: Webhooks don't need user authentication
4. **Error Handling**: Gracefully handles malformed requests
5. **Logging**: Comprehensive logging for debugging

## Monitoring

To monitor webhook health:

1. **Mux Dashboard**:
   - Webhooks → Your Webhook → Recent Deliveries
   - Shows success/failure rate

2. **Supabase Logs**:
   ```bash
   supabase functions logs mux-webhook --follow
   ```

3. **Database Queries**:
   ```sql
   -- Videos stuck in processing
   SELECT COUNT(*) FROM videos WHERE status = 'processing';
   
   -- Recent video updates
   SELECT id, title, status, updated_at
   FROM videos
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

## Next Steps

1. Deploy the webhook Edge Function
2. Configure the Mux webhook in the dashboard
3. Set the signing secret (optional but recommended)
4. Test with a real video upload
5. Monitor the logs to ensure it's working

Once webhooks are working, the frontend polling will serve as a backup, but most updates will happen instantly via webhooks.
