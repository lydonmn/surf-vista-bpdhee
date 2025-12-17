
# CORS Configuration Guide for SurfVista

## Problem
Videos won't play because of CORS (Cross-Origin Resource Sharing) restrictions. The video player cannot access files from Supabase Storage due to missing CORS configuration.

## Solution

### Option 1: Make Storage Bucket Public (Recommended for Your Use Case)

Since your videos are already protected by:
- Authentication (users must be logged in)
- Subscription checks (only subscribers can see videos)
- RLS policies on the database

Making the storage bucket public is the simplest solution:

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
2. Click **Storage** in the left sidebar
3. Click on the **videos** bucket
4. Click the **Settings** or **Configuration** tab
5. Toggle **Public bucket** to ON
6. Save changes

This allows anyone with the URL to access the video files, but they still need to:
- Be authenticated
- Have an active subscription
- Know the exact video URL (which is only shown to subscribers)

### Option 2: Configure CORS Policies

If you prefer to keep the bucket private and use signed URLs:

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
2. Click **Storage** in the left sidebar
3. Click on the **videos** bucket
4. Click **Settings** or **Configuration**
5. Find **CORS Configuration** section
6. Add these allowed origins:

**For Development:**
```
*
```
(Allows all origins - use only for testing)

**For Production:**
```
exp://localhost:8081
http://localhost:19006
https://natively.dev
https://your-production-domain.com
```

7. Set allowed methods:
```
GET, HEAD, OPTIONS
```

8. Set allowed headers:
```
authorization, x-client-info, apikey, content-type
```

9. Save changes

### Option 3: SQL Configuration (Advanced)

If you have SQL access, you can configure the bucket with this command:

```sql
-- Make the videos bucket public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'videos';

-- Verify the change
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name = 'videos';
```

## Verify Configuration

After making changes:

1. Restart your app
2. Try playing a video
3. Check the browser console (if on web) or app logs for any remaining CORS errors

## Current App Configuration

Your app already supports both public and signed URLs:

- **Public URLs**: Used when bucket is public (simpler, faster)
- **Signed URLs**: Used when bucket is private (more secure, expires after 1 hour)

The app will automatically try public URL first, then fall back to signed URL if needed.

## Recommended Settings for Your Videos Bucket

Based on your 6K video requirements:

- **Public**: ON (recommended)
- **File size limit**: 3221225472 bytes (3GB)
- **Allowed MIME types**: video/mp4, video/quicktime, video/x-msvideo
- **CORS**: Allow all origins (*) for development, specific origins for production

## Troubleshooting

If videos still won't play after configuring CORS:

1. **Clear browser cache** (if testing on web)
2. **Restart the Expo development server**
3. **Check Supabase logs**:
   - Go to Dashboard → Logs → Storage
   - Look for 403 or CORS-related errors
4. **Verify RLS policies** are not blocking access:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'videos';
   ```
5. **Test with a simple curl command**:
   ```bash
   curl -I https://ucbilksfpnmltrkwvzft.supabase.co/storage/v1/object/public/videos/your-video-file.mp4
   ```

## Security Notes

Making the bucket public is safe for your use case because:

- Videos are only listed in the database for authenticated subscribers
- Users need to know the exact filename to access a video
- The app only shows video URLs to authenticated, subscribed users
- You can still implement additional security at the application level

If you need maximum security, keep the bucket private and use signed URLs, but ensure CORS is properly configured.

## Next Steps

1. Choose Option 1 (make bucket public) for simplest setup
2. Test video playback in your app
3. If issues persist, check the app logs and Supabase storage logs
4. Consider implementing video analytics to track playback

## Support

If you continue to have issues:
- Check Supabase Storage documentation: https://supabase.com/docs/guides/storage
- Review CORS documentation: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- Contact Supabase support if configuration options are not visible
