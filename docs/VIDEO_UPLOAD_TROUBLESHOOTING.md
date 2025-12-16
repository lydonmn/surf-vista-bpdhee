
# Video Upload Troubleshooting Guide

## Overview
This guide addresses common issues with video uploads from iOS devices and provides optimization strategies.

## Recent Improvements

### iOS-Specific Fixes
1. **File Reading Method**: Changed to use base64 encoding for iOS compatibility
2. **ArrayBuffer Conversion**: Proper conversion from base64 to ArrayBuffer
3. **Content Type**: Explicit video content type setting
4. **Progress Tracking**: Visual feedback during upload
5. **File Size Warnings**: Alerts for large files (>500MB)

### Upload Process
```typescript
1. User selects video from library
2. App checks file size and warns if large
3. File is read as base64 (iOS) or ArrayBuffer (Android)
4. File is uploaded to Supabase Storage
5. Public URL is generated
6. Database record is created
7. Success confirmation shown
```

## Common Issues & Solutions

### Issue 1: Upload Fails on iOS
**Symptoms**: Upload starts but fails with error

**Solutions**:
- Check internet connection (uploads require stable connection)
- Verify file size is under 500MB
- Ensure video format is supported (MP4, MOV)
- Check Supabase storage bucket permissions

**Code Fix**: The app now uses base64 encoding for iOS:
```typescript
if (Platform.OS === 'ios') {
  const base64 = await FileSystem.readAsStringAsync(selectedVideo, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // Convert to ArrayBuffer
}
```

### Issue 2: Large File Upload Timeout
**Symptoms**: Upload hangs or times out for large files

**Solutions**:
- Use videos under 500MB (app now warns about this)
- Compress video before upload
- Use WiFi instead of cellular data
- Consider uploading shorter clips

**Compression Tips**:
- Use iPhone's built-in video compression
- Export at 1080p instead of 4K for faster uploads
- Reduce frame rate if possible (30fps vs 60fps)

### Issue 3: Upload Progress Not Showing
**Symptoms**: No feedback during upload

**Solution**: The app now shows:
- Progress bar with percentage
- File size information
- Upload status messages

### Issue 4: Storage Bucket Not Found
**Symptoms**: Error about missing 'videos' bucket

**Solution**: Verify Supabase storage bucket exists:
```sql
-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'videos';

-- If not, create it (done via Supabase dashboard)
```

### Issue 5: Permission Denied
**Symptoms**: Upload fails with permission error

**Solutions**:
1. Check RLS policies on videos table
2. Verify user is authenticated
3. Confirm user has admin privileges
4. Check storage bucket policies

## Optimization Strategies

### 1. Video Compression
Before uploading, compress videos:
- Use iOS Photos app: Settings → Camera → Record Video → 1080p at 30fps
- Use third-party apps like Video Compressor
- Export at lower bitrate

### 2. Network Optimization
- Use WiFi for uploads
- Avoid uploading during peak hours
- Check network speed before upload
- Consider chunked uploads for very large files

### 3. File Size Management
Current limits:
- Recommended: Under 200MB
- Warning threshold: 500MB
- Maximum: 1GB (Supabase default)

### 4. Format Selection
Best formats for upload:
- MP4 (H.264) - Best compatibility
- MOV (H.264) - iOS native
- Avoid: HEVC/H.265 (larger files)

## Testing Checklist

### Before Upload
- [ ] Video file size checked
- [ ] Internet connection stable
- [ ] User authenticated as admin
- [ ] Storage bucket exists
- [ ] Sufficient storage space

### During Upload
- [ ] Progress bar displays
- [ ] Percentage updates
- [ ] No timeout errors
- [ ] Network remains stable

### After Upload
- [ ] Success message shown
- [ ] Video appears in database
- [ ] Public URL accessible
- [ ] Video playable in app

## Monitoring & Debugging

### Console Logs
The app logs detailed information:
```
[AdminScreen] Starting video upload...
[AdminScreen] Video URI: file://...
[AdminScreen] Video size: 150.5 MB
[AdminScreen] Reading file...
[AdminScreen] File read successfully, uploading to Supabase...
[AdminScreen] Upload successful, getting public URL...
[AdminScreen] Public URL: https://...
[AdminScreen] Video record created successfully
```

### Error Messages
Common error messages and meanings:
- "Failed to pick video" - Permission issue or picker error
- "Failed to upload video" - Network or storage issue
- "Failed to create video record" - Database error

### Supabase Dashboard
Check in Supabase dashboard:
1. Storage → videos bucket → Verify file uploaded
2. Table Editor → videos → Check record created
3. Logs → Check for errors

## Performance Metrics

### Upload Times (Approximate)
- 50MB video: 30-60 seconds (WiFi)
- 100MB video: 1-2 minutes (WiFi)
- 200MB video: 2-4 minutes (WiFi)
- 500MB video: 5-10 minutes (WiFi)

Times may vary based on:
- Network speed
- Server load
- File format
- Compression level

## Best Practices

### For Admins
1. Record videos at 1080p, not 4K
2. Keep videos under 5 minutes
3. Use WiFi for uploads
4. Upload during off-peak hours
5. Verify upload success before leaving app

### For Developers
1. Monitor Supabase storage usage
2. Set up storage quotas
3. Implement cleanup for old videos
4. Consider CDN for video delivery
5. Add retry logic for failed uploads

## Future Enhancements

Potential improvements:
1. Background upload support
2. Resumable uploads
3. Automatic video compression
4. Chunked upload for large files
5. Upload queue management
6. Thumbnail generation
7. Video transcoding

## Support

If issues persist:
1. Check console logs for detailed errors
2. Verify Supabase project status
3. Test with smaller video files
4. Try different network connection
5. Contact support with error logs

## Related Files
- `app/admin.tsx` - Upload implementation
- `app/integrations/supabase/client.ts` - Supabase config
- `docs/ADMIN_QUICK_GUIDE.md` - Admin features guide
