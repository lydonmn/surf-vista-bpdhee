
# Video Upload Fix - File Size Limits

## Problem
Videos were failing to upload with a 413 error: "Payload too large" - indicating the file exceeded Supabase storage limits.

## Solution Implemented

### 1. File Size Validation
- **Maximum file size**: 50MB (Supabase free tier limit)
- **Recommended size**: Under 30MB for optimal performance
- Pre-upload validation prevents attempting to upload files that will fail
- Clear error messages guide users to reduce file size

### 2. Improved User Experience
- **Warning box** displays file size limits prominently
- **File size indicator** shows selected video size with color coding:
  - Green/normal: Under 30MB (recommended)
  - Red/warning: 30-50MB (allowed but may be slow)
  - Blocked: Over 50MB (exceeds limit)
- **Helpful tips** for reducing file size

### 3. Better Error Handling
- Specific error messages for different failure scenarios
- Guidance on how to fix file size issues
- Network error detection and recovery suggestions

## How to Upload Videos Successfully

### Best Practices
1. **Record at 1080p** instead of 4K/6K resolution
2. **Keep videos under 5 minutes** in length
3. **Use a stable WiFi connection** for uploads
4. **Compress videos** before uploading if needed

### Video Recording Settings
For iPhone users:
- Go to Settings → Camera → Record Video
- Select "1080p at 30 fps" or "1080p at 60 fps"
- Avoid "4K at 60 fps" for videos intended for upload

For Android users:
- Open Camera app → Settings → Video quality
- Select "FHD 1080p" instead of "UHD 4K"

### Video Compression Options
If you have a large video that needs to be uploaded:

1. **iOS**: Use the Photos app
   - Select video → Share → Save to Files
   - This creates a compressed version

2. **Android**: Use Google Photos
   - Upload to Google Photos (compressed version)
   - Download and use that version

3. **Desktop**: Use free tools like:
   - HandBrake (cross-platform)
   - iMovie (Mac)
   - Windows Video Editor (Windows)

## Technical Details

### Supabase Storage Limits
- **Free tier**: 1GB total storage, 50MB per file
- **Pro tier**: 100GB total storage, 5GB per file
- Files are uploaded using multipart upload for reliability

### Upload Method
- Uses `FileSystem.uploadAsync` with multipart upload
- Progress tracking for user feedback
- Automatic retry logic for network issues
- Session-based authentication

## Troubleshooting

### "File Too Large" Error
**Solution**: Reduce video file size
- Record at lower resolution (1080p)
- Shorten video duration
- Compress video before upload

### Upload Stuck at 100%
**Solution**: This is normal - the server is processing
- Wait 30-60 seconds
- Video is being finalized on server
- Database record is being created

### Network Request Failed
**Solution**: Check connection
- Ensure stable WiFi connection
- Try again with smaller file
- Avoid cellular data for large uploads

### Upload Fails Repeatedly
**Solution**: Multiple approaches
1. Try a different WiFi network
2. Reduce video quality/length
3. Upload during off-peak hours
4. Contact support if issue persists

## Future Enhancements

### Potential Improvements
1. **In-app video compression**: Automatically compress videos before upload
2. **Chunked uploads**: Split large files into smaller chunks
3. **Resume capability**: Resume interrupted uploads
4. **Cloud processing**: Use edge functions for server-side compression
5. **Progress persistence**: Save upload progress across app restarts

### Upgrade Path
For handling larger videos (4K/6K):
- Upgrade to Supabase Pro tier (5GB per file limit)
- Implement chunked upload strategy
- Add server-side video transcoding
- Consider CDN integration for video delivery

## Support

If you continue to experience issues:
1. Check video file size and format
2. Verify internet connection stability
3. Try uploading a test video (under 10MB)
4. Review app logs for specific error messages
5. Contact support with error details

## Summary

The video upload system now:
- ✅ Validates file sizes before upload
- ✅ Provides clear size limits and warnings
- ✅ Offers helpful tips for reducing file size
- ✅ Shows detailed error messages
- ✅ Tracks upload progress accurately
- ✅ Handles network issues gracefully

Users should record videos at 1080p resolution and keep them under 5 minutes for best results.
