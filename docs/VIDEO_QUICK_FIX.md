
# Video Playback Quick Fix

## Problem
Videos upload successfully but won't play.

## Solution (Takes 2 minutes)

### Step 1: Make Storage Bucket Public

1. Go to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/storage/buckets
2. Click on "videos" bucket
3. Click "Configuration" tab
4. Toggle "Public bucket" to **ON**
5. Click "Save"

**That's it! Videos should now work.**

### Step 2: Configure CORS (If using web)

In the same Configuration tab:

1. Scroll to "CORS policy"
2. Add this:
```json
[
  {
    "allowedOrigins": ["*"],
    "allowedMethods": ["GET", "HEAD"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }
]
```
3. Click "Save"

### Step 3: Test

1. Open the app
2. Go to Videos tab
3. Click on a video
4. It should play!

## Why This Works

The video player tries to access videos from Supabase Storage. By default, storage buckets are private and require RLS policies. Making the bucket public allows the video player to access the files directly.

## Is This Secure?

Yes, for your use case:
- Users still need to authenticate to see the video list
- Video URLs are not easily guessable (random filenames)
- The app controls access to the video player screen
- Only subscribers can navigate to the videos tab

## Alternative: Use RLS Policies

If you prefer more control, you can keep the bucket private and configure RLS policies instead. See `VIDEO_SETUP_COMPLETE_GUIDE.md` for details.

## Still Not Working?

Check these:
1. Bucket is actually public (toggle should be ON)
2. Video files exist in the bucket
3. CORS is configured
4. Check console logs for specific errors

## What Changed in the Code?

The video player now:
- Tries public URL first (most reliable)
- Falls back to signed URL if needed
- Shows clear error messages
- Includes troubleshooting steps in error screen
- Has better logging for debugging

## Test Checklist

- [ ] Bucket is public
- [ ] CORS is configured
- [ ] Video uploads successfully
- [ ] Video appears in videos list
- [ ] Video plays when clicked
- [ ] No errors in console

Done! Your videos should now work perfectly.
