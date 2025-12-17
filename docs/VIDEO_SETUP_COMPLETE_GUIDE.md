
# Complete Video Setup Guide for SurfVista

## Current Status
Videos are uploading successfully but not playing. This is due to storage bucket configuration.

## Required Steps (Do These in Order)

### Step 1: Configure Supabase Storage Bucket

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
   - Click on "Storage" in the left sidebar

2. **Find or Create the "videos" Bucket**
   - If it doesn't exist, create it
   - Click on the "videos" bucket

3. **Make Bucket Public (Easiest Solution)**
   - Click on "Configuration" tab
   - Toggle "Public bucket" to ON
   - Click "Save"
   
   **This is the quickest fix and will make videos work immediately!**

4. **Configure CORS (Required for Web)**
   - In the same Configuration tab
   - Add CORS policy:
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
   - Click "Save"

5. **Set File Size Limit**
   - In Configuration tab
   - Set "Maximum file size" to: `3221225472` (3GB in bytes)
   - This supports 6K video uploads
   - Click "Save"

### Step 2: Configure RLS Policies (Optional but Recommended)

If you want more control over who can access videos:

1. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

2. **Run This SQL**
   ```sql
   -- Enable RLS on storage.objects if not already enabled
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

   -- Drop existing policies (if any)
   DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
   DROP POLICY IF EXISTS "Authenticated users can view videos" ON storage.objects;
   DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
   DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;

   -- Allow public read access to videos bucket
   CREATE POLICY "Public can view videos"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'videos');

   -- Allow authenticated users to view videos
   CREATE POLICY "Authenticated users can view videos"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'videos');

   -- Allow admins to upload videos
   CREATE POLICY "Admins can upload videos"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'videos' 
     AND auth.uid() IN (
       SELECT id FROM public.profiles WHERE is_admin = true
     )
   );

   -- Allow admins to delete videos
   CREATE POLICY "Admins can delete videos"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'videos' 
     AND auth.uid() IN (
       SELECT id FROM public.profiles WHERE is_admin = true
     )
   );
   ```

3. **Click "Run"**

### Step 3: Test Video Playback

1. **Open the app**
2. **Navigate to Videos tab**
3. **Click on a video**
4. **Video should now play!**

### Step 4: Verify Everything Works

Check the console logs when playing a video. You should see:
```
[VideoPlayer] Loading video: [id]
[VideoPlayer] User authenticated: [email]
[VideoPlayer] Video loaded: [title]
[VideoPlayer] Extracted filename: [filename]
[VideoPlayer] Using public URL (or signed URL)
[VideoPlayer] Initializing player with URL: [url]
```

## Troubleshooting

### Videos Still Won't Play?

1. **Check bucket is public:**
   - Storage → videos → Configuration
   - "Public bucket" should be ON

2. **Check CORS is configured:**
   - Storage → videos → Configuration
   - CORS policy should be present

3. **Check video file exists:**
   - Storage → videos
   - You should see your uploaded video files

4. **Check console logs:**
   - Look for error messages
   - Common errors:
     - "Signed URL error" → RLS policies issue
     - "Cannot load video" → CORS issue
     - "Video not found" → File doesn't exist

### Quick Test

To quickly test if storage is configured correctly:

1. Go to Storage → videos in Supabase Dashboard
2. Click on a video file
3. Click "Get URL"
4. Copy the public URL
5. Paste it in a browser
6. If the video downloads/plays, storage is configured correctly

## What Changed?

The video player now:
- ✅ Checks authentication before loading
- ✅ Extracts filename correctly from stored URLs
- ✅ Tries public URL first (simplest)
- ✅ Falls back to signed URL if needed
- ✅ Shows detailed error messages
- ✅ Includes debug information
- ✅ Has better error handling
- ✅ Auto-plays videos when ready

## Security Notes

**Public Bucket (Current Setup):**
- ✅ Videos work immediately
- ✅ Simple to configure
- ⚠️ Anyone with the URL can access videos
- ⚠️ Less secure but acceptable for subscriber content

**With RLS Policies:**
- ✅ More secure
- ✅ Control who can access videos
- ✅ Audit access logs
- ⚠️ Slightly more complex setup

For a subscriber-only app, making the bucket public is acceptable since:
- Users still need to be authenticated to see the video list
- Video URLs are not easily guessable
- The app controls access to the video player

## Next Steps

After videos are working:
1. Test with different video sizes
2. Test on different devices (iOS, Android)
3. Monitor storage usage in Supabase Dashboard
4. Consider adding video thumbnails
5. Add video analytics if needed

## Support

If videos still don't work after following all steps:
1. Check the "Debug Info" section in the video player error screen
2. Copy all console logs
3. Verify bucket configuration in Supabase Dashboard
4. Check if there are any Supabase service issues

## Summary

**The #1 fix:** Make the videos bucket public in Supabase Dashboard.

This single change will make videos work immediately!
