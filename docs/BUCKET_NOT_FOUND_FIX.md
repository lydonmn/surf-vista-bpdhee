
# Fix: "Bucket not found" Error

## Problem
When uploading videos, you get the error:
```
Upload failed with status 400:
{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}
```

## Root Cause
The `videos` storage bucket doesn't exist in your Supabase project.

## Solution

### Option 1: Create via Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
   - Navigate to **Storage** → **Buckets**

2. **Create New Bucket**
   - Click **"New bucket"**
   - Name: `videos`
   - Public: ✅ **Enabled**
   - File size limit: `3221225472` (3GB)
   - Allowed MIME types:
     - `video/mp4`
     - `video/quicktime`
     - `video/x-msvideo`
     - `video/x-matroska`
     - `video/webm`

3. **Configure Policies**
   - Go to **Storage** → **Policies**
   - Select `videos` bucket
   - Add these policies:

   **Upload Policy:**
   ```
   Name: Authenticated users can upload videos
   Operation: INSERT
   Roles: authenticated
   Definition: bucket_id = 'videos'
   ```

   **Read Policy:**
   ```
   Name: Public can view videos
   Operation: SELECT
   Roles: public
   Definition: bucket_id = 'videos'
   ```

   **Update Policy:**
   ```
   Name: Users can update their own videos
   Operation: UPDATE
   Roles: authenticated
   USING: bucket_id = 'videos' AND auth.uid()::text = owner
   ```

   **Delete Policy:**
   ```
   Name: Users can delete their own videos
   Operation: DELETE
   Roles: authenticated
   USING: bucket_id = 'videos' AND auth.uid()::text = owner
   ```

### Option 2: Create via SQL

1. Go to **SQL Editor** in Supabase Dashboard
2. Run the SQL script from `docs/CREATE_VIDEOS_BUCKET.sql`
3. Click **"Run"**

### Verification

After creating the bucket:

1. Go to **Storage** in Supabase Dashboard
2. Verify the `videos` bucket exists
3. Check that it's marked as **Public**
4. Verify the file size limit is set to 3GB
5. Test uploading a video from your app

### Troubleshooting

If you still get errors after creating the bucket:

1. **Check bucket name**: Must be exactly `videos` (lowercase)
2. **Verify public access**: Bucket must be marked as public
3. **Check RLS policies**: Ensure all 4 policies are created
4. **Verify authentication**: Make sure you're logged in when uploading
5. **Check file size**: Ensure your video is under 3GB
6. **Review CORS settings**: Add CORS policy if needed

### Common Issues

**Issue**: "Payload too large" error
- **Solution**: Increase file size limit to 3GB (3221225472 bytes)

**Issue**: "Permission denied" error
- **Solution**: Check RLS policies are correctly configured

**Issue**: Videos upload but can't be viewed
- **Solution**: Ensure bucket is marked as public and read policy exists

## Next Steps

After fixing the bucket issue:

1. Test uploading a small video first
2. Verify the video appears in the Videos tab
3. Test video playback
4. Try uploading a larger 6K video
5. Monitor upload progress and completion

## Support

If you continue to have issues:
- Check Supabase logs in Dashboard → Logs
- Verify your Supabase project is active
- Ensure you have sufficient storage quota
- Contact Supabase support if needed
