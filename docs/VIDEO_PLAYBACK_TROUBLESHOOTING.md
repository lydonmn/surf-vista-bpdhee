
# Video Playback Troubleshooting Guide

## Issue: Videos Won't Play

If videos are uploading successfully but won't play, follow these steps:

### 1. Check Supabase Storage Bucket Configuration

Go to your Supabase Dashboard → Storage → videos bucket:

#### A. Enable Public Access (Recommended for Signed URLs)
- Click on the "videos" bucket
- Go to "Configuration" tab
- Enable "Public bucket" option
- This allows signed URLs to work properly

#### B. Configure CORS Settings
Add these CORS rules to your videos bucket:
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

#### C. Set File Size Limit
- Maximum file size: 3221225472 bytes (3GB)
- This supports 6K video uploads

### 2. Configure Row Level Security (RLS) Policies

Run this SQL in your Supabase SQL Editor:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;

-- Create RLS policies for the videos bucket
-- Policy 1: Allow authenticated users to read/download videos
CREATE POLICY "Authenticated users can view videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'videos');

-- Policy 2: Allow admins to upload videos
CREATE POLICY "Admins can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND (auth.uid() IN (
    SELECT id FROM public.profiles WHERE is_admin = true
  ))
);

-- Policy 3: Allow admins to delete videos
CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND (auth.uid() IN (
    SELECT id FROM public.profiles WHERE is_admin = true
  ))
);

-- Policy 4: Allow public access to videos (fallback for signed URLs)
-- This is needed for signed URLs to work properly
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT INSERT, DELETE ON storage.objects TO authenticated;
```

### 3. Verify Video Upload Format

Check that videos are being uploaded with the correct path format:
- Correct: `videos/1234567890.mp4`
- Incorrect: `/videos/1234567890.mp4` or `1234567890.mp4`

### 4. Test Video Access

#### A. Test Signed URL Generation
In your app, check the console logs for:
```
[VideoPlayer] Creating signed URL for: [filename]
[VideoPlayer] Signed URL created successfully
```

If you see errors, the RLS policies may not be configured correctly.

#### B. Test Public URL Access
If signed URLs fail, the app will fall back to public URLs. Check logs for:
```
[VideoPlayer] Using public URL
```

### 5. Common Error Messages and Solutions

#### "Signed URL error: new row violates row-level security policy"
**Solution:** The storage bucket RLS policies are not configured. Run the SQL above.

#### "Video playback error: Cannot load video"
**Solution:** 
- Check CORS configuration
- Verify the video file exists in storage
- Ensure the bucket is public or has proper RLS policies

#### "Failed to generate video URL"
**Solution:**
- Check that the video URL in the database is correct
- Verify the filename can be extracted from the URL
- Ensure authentication is working

### 6. Quick Fix: Make Bucket Public

If you need videos to work immediately:

1. Go to Supabase Dashboard → Storage → videos bucket
2. Click "Configuration"
3. Enable "Public bucket"
4. Save changes

This will allow all videos to be accessed via public URLs without authentication.

**Note:** This is less secure but will make videos work immediately. You can add RLS policies later for better security.

### 7. Verify Video Player Logs

When playing a video, you should see these logs in order:
```
[VideoPlayer] Loading video: [video-id]
[VideoPlayer] User authenticated: [email]
[VideoPlayer] Video loaded: [title]
[VideoPlayer] Extracted filename: [filename]
[VideoPlayer] Creating signed URL for: [filename]
[VideoPlayer] Signed URL created successfully
[VideoPlayer] Initializing player with URL: [url]
[VideoPlayer] Video ready to play
```

If any step fails, check the corresponding configuration above.

### 8. Test with a Small Video First

Before uploading large 6K videos:
1. Upload a small test video (< 50MB)
2. Verify it plays correctly
3. Check all logs are successful
4. Then proceed with larger videos

### 9. Network Considerations

For large video files:
- Use a stable WiFi connection
- Ensure sufficient bandwidth for streaming
- Consider video compression for better streaming performance
- Large 6K videos may take time to buffer

### 10. Contact Support

If videos still won't play after following all steps:
1. Check the debug info shown in the video player error screen
2. Copy all console logs from the video player
3. Verify your Supabase project settings
4. Check if there are any Supabase service issues

## Quick Checklist

- [ ] Storage bucket "videos" exists
- [ ] Bucket is set to public OR has RLS policies configured
- [ ] CORS is configured on the bucket
- [ ] File size limit is set to 3GB
- [ ] RLS policies are created (run SQL above)
- [ ] Videos are uploading successfully
- [ ] Video URLs in database are correct format
- [ ] User is authenticated when trying to play videos
- [ ] Console logs show successful signed URL generation
- [ ] Network connection is stable

## Still Not Working?

The most common issue is **RLS policies not configured**. 

**Quick fix:** Make the bucket public temporarily:
1. Supabase Dashboard → Storage → videos
2. Configuration → Enable "Public bucket"
3. Save

This will make videos work immediately while you configure proper RLS policies.
