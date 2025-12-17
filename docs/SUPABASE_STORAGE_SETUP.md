
# Supabase Storage Configuration for 6K Video Uploads

## Overview
To support 6K video uploads up to 90 seconds (up to 3GB file size), you need to configure your Supabase storage bucket properly.

## Step-by-Step Configuration

### 1. Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Navigate to **Storage** in the left sidebar

### 2. Configure Videos Bucket
1. Click on the **videos** bucket
2. Click the **Settings** icon (gear icon) in the top right
3. Update the following settings:

#### File Size Limit
- **Maximum file size**: `3221225472` bytes (3GB)
- This allows 6K videos up to 90 seconds

#### Public Access
- **Public bucket**: Enabled (so videos can be viewed by subscribers)

#### Allowed MIME types
Add the following video formats:
- `video/mp4`
- `video/quicktime`
- `video/x-msvideo`
- `video/x-matroska`
- `video/webm`

### 3. Update Storage Policies (if needed)

Run this SQL in your Supabase SQL Editor to ensure proper access:

```sql
-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Allow public read access to videos
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Allow admins to delete videos
CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);
```

### 4. Verify Configuration

Test the configuration by:
1. Opening the admin panel in your app
2. Selecting a 6K video (under 3GB)
3. Uploading the video
4. Checking for any errors

### 5. Troubleshooting

#### Error: "Payload too large" (413)
- **Cause**: Storage bucket file size limit is too low
- **Solution**: Increase the maximum file size in bucket settings to 3GB

#### Error: "Unauthorized" (401)
- **Cause**: Storage policies not configured correctly
- **Solution**: Run the SQL policies above

#### Error: "Network request failed"
- **Cause**: Poor internet connection or timeout
- **Solution**: Use a stable WiFi connection and try again

#### Upload takes too long
- **Expected**: 6K videos can take 5-15 minutes to upload
- **Recommendation**: Ensure stable internet connection and keep app open

## File Size Estimates

| Resolution | Duration | Bitrate | Estimated Size |
|------------|----------|---------|----------------|
| 6K (6144x3160) | 30 sec | 100 Mbps | ~375 MB |
| 6K (6144x3160) | 60 sec | 100 Mbps | ~750 MB |
| 6K (6144x3160) | 90 sec | 100 Mbps | ~1.1 GB |
| 6K (6144x3160) | 90 sec | 150 Mbps | ~1.7 GB |

## Best Practices

1. **Compress videos before upload**: Use video editing software to optimize file size while maintaining quality
2. **Use H.265 (HEVC) codec**: Provides better compression than H.264
3. **Test with smaller videos first**: Verify configuration works before uploading large files
4. **Monitor storage usage**: Check Supabase dashboard for storage limits
5. **Use WiFi for uploads**: Cellular data may be slow and expensive for large files

## Storage Limits by Plan

| Plan | Storage Included | Max File Size |
|------|------------------|---------------|
| Free | 1 GB | 50 MB (default) |
| Pro | 8 GB | Configurable up to 5 GB |
| Team | 100 GB | Configurable up to 5 GB |
| Enterprise | Custom | Custom |

**Note**: You need at least the **Pro plan** to upload 6K videos over 50MB.

## Next Steps

After configuring storage:
1. Test video upload with a small 6K video
2. Verify video playback in the app
3. Test with a full 90-second 6K video
4. Monitor storage usage in Supabase dashboard

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs → Storage
2. Review error messages in the app
3. Contact Supabase support for plan-specific limits
