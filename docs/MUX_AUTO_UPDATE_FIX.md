
# Mux Video Auto-Update Fix - Complete

## Problem
The video uploader was working perfectly, but you had to manually:
1. Paste the Mux URL into Supabase
2. Paste the Mux asset ID into Supabase  
3. Change the status from "errored" to "active" in Supabase

## Solution
The system now automatically updates Supabase with the Mux URL and asset ID through webhooks, and sets the status to "active" when the video is ready.

## How It Works

### 1. Upload Flow
```
User uploads video → Mux creates upload → Database saves with status="processing"
                                                ↓
                                    Mux processes video
                                                ↓
                                    Mux sends webhooks
                                                ↓
                            Webhook updates database automatically
```

### 2. Webhook Events

The `mux-webhook` Edge Function handles three events:

#### Event 1: `video.upload.asset_created`
- **When**: Upload completes and Mux creates an asset
- **What it does**: Links the upload ID to the asset ID in the database
- **Database update**: Sets `mux_asset_id` field

#### Event 2: `video.asset.ready`
- **When**: Video transcoding is complete and ready to play
- **What it does**: Updates the video URL and sets status to active
- **Database update**: 
  - Sets `video_url` to the HLS playback URL
  - Sets `status` to "active"
  - Confirms `mux_asset_id`

#### Event 3: `video.asset.errored`
- **When**: Video processing fails
- **What it does**: Marks the video as errored
- **Database update**: Sets `status` to "errored"

### 3. Manual Sync Function

For videos that are stuck in "processing" or "errored" status, there's now a **"Sync Videos with Mux"** button in the admin panel.

**What it does:**
1. Finds all videos with status "processing" or "errored"
2. Checks each video's status with Mux API
3. If the asset is ready:
   - Gets the playback URL
   - Updates the database with the URL
   - Sets status to "active"
4. If the asset is still processing:
   - Leaves it as "processing"
5. If the asset errored:
   - Sets status to "errored"

## Database Schema

The `videos` table has these Mux-related columns:

```sql
- mux_upload_id: text (nullable) - The Mux upload ID from the direct upload
- mux_asset_id: text (nullable) - The Mux asset ID after processing starts
- video_url: text - The HLS playback URL (https://stream.mux.com/{playback_id}.m3u8)
- status: text - One of: 'active', 'processing', 'errored'
```

## Testing the Fix

### For New Uploads:
1. Upload a video through the admin panel
2. The video will show status "processing" immediately
3. Wait 1-2 minutes for Mux to process
4. The webhook will automatically update the video to "active" with the playback URL
5. The video will appear in the app ready to play

### For Existing Videos:
1. Go to the admin panel
2. Click "Sync Videos with Mux" button
3. The system will check all processing/errored videos
4. Videos that are ready will be updated to "active" automatically
5. You'll see a summary of how many videos were updated

## Webhook Setup

The webhook is already deployed at:
```
https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/mux-webhook
```

**Mux Webhook Configuration:**
1. Go to Mux Dashboard → Settings → Webhooks
2. Add webhook URL: `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/mux-webhook`
3. Subscribe to events:
   - `video.upload.asset_created`
   - `video.asset.ready`
   - `video.asset.errored`

## Debugging

### Check Webhook Logs:
```bash
# View webhook function logs
supabase functions logs mux-webhook --project-ref ucbilksfpnmltrkwvzft
```

### Check Sync Function Logs:
```bash
# View sync function logs
supabase functions logs mux-sync-videos --project-ref ucbilksfpnmltrkwvzft
```

### Manual Database Check:
```sql
-- See all videos and their Mux status
SELECT 
  id, 
  title, 
  status, 
  mux_upload_id, 
  mux_asset_id, 
  video_url,
  created_at
FROM videos
ORDER BY created_at DESC
LIMIT 10;
```

## What Changed

### Files Modified:
1. **supabase/functions/mux-webhook/index.ts**
   - Added better logging for debugging
   - Added database query logging when videos aren't found
   - Improved error handling

2. **app/admin.tsx**
   - Added "Sync Videos with Mux" button for manual sync

### Files Created:
1. **supabase/functions/mux-sync-videos/index.ts**
   - New Edge Function to manually check and update videos
   - Queries Mux API for each processing/errored video
   - Updates database when videos are ready

## Benefits

✅ **No more manual work** - Videos automatically update when ready
✅ **Automatic status tracking** - Videos show correct status (processing/active/errored)
✅ **Manual sync option** - Can fix stuck videos with one click
✅ **Better debugging** - Detailed logs show exactly what's happening
✅ **Reliable** - Webhook retries ensure updates don't get lost

## Next Steps

1. **Test with a new upload** - Upload a video and watch it automatically become active
2. **Sync existing videos** - Click "Sync Videos with Mux" to fix any stuck videos
3. **Monitor webhooks** - Check Mux dashboard to ensure webhooks are being delivered
4. **Check logs** - Use the debugging commands above if anything seems wrong

The system is now fully automated! 🎉
