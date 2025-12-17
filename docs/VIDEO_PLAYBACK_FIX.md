
# Video Playback Fix Guide

## Issue
Videos are not playing in the SurfVista app.

## Root Causes
The video playback issue is typically caused by one or more of the following:

1. **Storage Bucket RLS Policies** - The most common issue
2. **Bucket Public Access Settings**
3. **Video URL Format Issues**
4. **CORS Configuration**

## Solution Steps

### Step 1: Fix Storage Bucket Policies (CRITICAL)

Go to your Supabase Dashboard and run this SQL in the SQL Editor:

```sql
-- Make the videos bucket public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'videos';

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update videos" ON storage.objects;

-- Create new policies

-- Allow public read access (CRITICAL for video playback)
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

-- Allow authenticated users to view
CREATE POLICY "Authenticated users can view videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'videos');

-- Allow admins to upload
CREATE POLICY "Admins can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);

-- Allow admins to delete
CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);

-- Allow admins to update
CREATE POLICY "Admins can update videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);
```

### Step 2: Verify Bucket Settings

1. Go to Supabase Dashboard → Storage → videos bucket
2. Click on "Settings" (gear icon)
3. Ensure:
   - **Public bucket**: Enabled (toggle should be ON)
   - **File size limit**: 3221225472 bytes (3GB)
   - **Allowed MIME types**: Leave empty or add `video/*`

### Step 3: Check CORS Settings

1. Go to Supabase Dashboard → Storage → Configuration
2. Add CORS policy if not present:
   ```json
   {
     "allowedOrigins": ["*"],
     "allowedMethods": ["GET", "HEAD"],
     "allowedHeaders": ["*"],
     "maxAge": 3600
   }
   ```

### Step 4: Test Video Access

After applying the fixes:

1. Upload a test video through the admin panel
2. Check the video URL in the database
3. Try accessing the URL directly in a browser
4. If the video downloads/plays in browser, the app should work

### Step 5: Verify Video Table Policies

Run this SQL to ensure the videos table has proper policies:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view videos" ON videos;
DROP POLICY IF EXISTS "Admins can insert videos" ON videos;
DROP POLICY IF EXISTS "Admins can delete videos" ON videos;
DROP POLICY IF EXISTS "Admins can update videos" ON videos;

-- Create new policies
CREATE POLICY "Authenticated users can view videos"
ON videos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert videos"
ON videos FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);

CREATE POLICY "Admins can delete videos"
ON videos FOR DELETE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);

CREATE POLICY "Admins can update videos"
ON videos FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);
```

## Debugging

The updated video player now includes:

1. **Multiple URL methods**: Tries signed URL, public URL, and database URL
2. **Detailed logging**: Check console logs for `[VideoPlayer]` messages
3. **Debug info card**: Shows video ID and URL on the player screen
4. **Better error messages**: Explains what might be wrong
5. **Retry button**: Allows retrying without going back

### Check Console Logs

Look for these log messages:
- `[VideoPlayer] Loading video:` - Video ID being loaded
- `[VideoPlayer] Video URL from DB:` - URL from database
- `[VideoPlayer] Extracted filename:` - Parsed filename
- `[VideoPlayer] Signed URL created successfully` - Signed URL worked
- `[VideoPlayer] Final video URL:` - URL being used for playback
- `[VideoPlayer] Initializing player` - Player starting
- `[VideoPlayer] Status changed:` - Player status updates
- `[VideoPlayer] Player error:` - Any player errors

## Common Issues

### Issue: "Video not found"
- Check if video exists in database
- Verify video_url column has a value

### Issue: "Failed to load video"
- Check storage bucket policies (Step 1)
- Verify bucket is public (Step 2)
- Check CORS settings (Step 3)

### Issue: "Video playback error"
- Video file might be corrupted
- Video format not supported (use MP4 H.264)
- Network connectivity issues

### Issue: "Payload too large" during upload
- Increase bucket file size limit to 3GB
- See admin panel warning box for instructions

## Testing Checklist

- [ ] Storage bucket is public
- [ ] RLS policies allow public SELECT on storage.objects
- [ ] Video URL is accessible in browser
- [ ] Console shows successful URL generation
- [ ] Video player initializes without errors
- [ ] Video plays when tapped
- [ ] Controls work (play/pause/restart)

## Still Not Working?

If videos still don't play after following all steps:

1. Check the Debug Info card on the video player screen
2. Copy the video URL and try opening it in a browser
3. Check browser console for CORS errors
4. Verify you're logged in as an authenticated user
5. Try uploading a new video after fixing policies
6. Check Supabase logs for any errors

## Support

If you continue to have issues:
1. Check console logs for `[VideoPlayer]` messages
2. Verify all SQL commands ran successfully
3. Ensure you're using the latest version of the app
4. Try logging out and back in
