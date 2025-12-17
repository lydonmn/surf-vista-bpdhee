
# 6K Video Upload Implementation

## Overview
This implementation adds support for uploading high-resolution 6K drone videos with strict validation requirements:
- **Minimum Resolution**: 6K (6144x3160 pixels)
- **Maximum Duration**: 90 seconds
- **Maximum File Size**: 2GB (to accommodate high-quality 6K video)

## Changes Made

### 1. Client-Side Validation
The admin screen now validates videos before upload:

#### Resolution Check
- Extracts video dimensions using `expo-image-picker` asset info
- Validates minimum 6K resolution (6144x3160)
- Displays resolution in user-friendly format (e.g., "6K (6144x3160)")

#### Duration Check
- Extracts video duration using `expo-av`
- Validates maximum 90 seconds
- Displays duration in MM:SS format

#### File Size Check
- Increased maximum file size to 2GB (from 50MB)
- Recommended size: 1.5GB for optimal upload performance
- Validates before upload attempt

### 2. Enhanced UI/UX

#### Requirements Display
A prominent blue info box shows all requirements:
- Minimum Resolution: 6K (6144x3160)
- Maximum Duration: 90 seconds
- Maximum File Size: 2GB
- Recommended: Under 1.5GB

#### Real-Time Validation Feedback
After selecting a video, the app displays:
- ✓ Green box with checkmark if video meets all requirements
- ✗ Red box with X if video fails validation
- Detailed metadata:
  - Resolution (color-coded: green if valid, red if invalid)
  - Duration (color-coded: green if valid, red if invalid)
  - File size (color-coded: green if valid, red if invalid)
- Specific error messages for each failed requirement

#### Upload Progress
Enhanced progress tracking for large files:
- Progress bar with percentage
- File size being uploaded
- Estimated time remaining message
- Warning to keep app open during upload

### 3. Video Metadata Extraction

The implementation uses multiple methods to extract video metadata:

```typescript
// Get file size
const fileInfo = await FileSystem.getInfoAsync(uri);
const fileSize = fileInfo.size;

// Get resolution
const asset = await ImagePicker.getAssetInfoAsync(uri);
const width = asset.width;
const height = asset.height;

// Get duration
const { sound, status } = await Video.Sound.createAsync({ uri });
const duration = status.durationMillis / 1000;
```

### 4. Database Schema Updates

**IMPORTANT**: You need to run this migration in your Supabase dashboard:

```sql
-- Add video metadata columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Add comments for documentation
COMMENT ON COLUMN videos.resolution_width IS 'Video width in pixels (e.g., 6144 for 6K)';
COMMENT ON COLUMN videos.resolution_height IS 'Video height in pixels (e.g., 3160 for 6K)';
COMMENT ON COLUMN videos.duration_seconds IS 'Video duration in seconds (max 90)';
COMMENT ON COLUMN videos.file_size_bytes IS 'File size in bytes';

-- Create index for querying by resolution
CREATE INDEX IF NOT EXISTS idx_videos_resolution ON videos(resolution_width, resolution_height);

-- Create index for querying by duration
CREATE INDEX IF NOT EXISTS idx_videos_duration ON videos(duration_seconds);
```

### 5. Supabase Storage Configuration

**IMPORTANT**: You need to update your Supabase storage settings:

1. Go to Supabase Dashboard → Storage → Settings
2. Update the file size limit for the `videos` bucket:
   - Maximum file size: 2GB (2147483648 bytes)
3. Ensure you have sufficient storage quota for your plan

#### Storage Requirements
- Free tier: 1GB total storage (not sufficient for 6K videos)
- Pro tier: 100GB total storage, 5GB per file (recommended)
- **You will need to upgrade to Pro tier** to support 6K video uploads

### 6. Network Requirements

6K video uploads require:
- **Stable WiFi connection** (cellular not recommended)
- **Fast upload speed**: Minimum 10 Mbps recommended
- **Upload time**: 5-15 minutes for 1-2GB files
- **Keep app open**: Upload will fail if app is closed or backgrounded

## Usage Instructions

### For Admins

1. **Record 6K Video**
   - Use a drone or camera capable of 6K recording
   - Keep video under 90 seconds
   - Recommended settings:
     - Resolution: 6K (6144x3160) or higher
     - Frame rate: 30fps or 60fps
     - Bitrate: 100-150 Mbps
     - Format: MP4 (H.264 or H.265)

2. **Upload Process**
   - Open Admin Panel
   - Tap "Select Video"
   - Choose your 6K video
   - Wait for validation (5-10 seconds)
   - Review validation results:
     - Green box = Ready to upload
     - Red box = Does not meet requirements
   - Enter video title and description
   - Tap "Upload 6K Video"
   - Keep app open during upload (5-15 minutes)
   - Wait for success confirmation

3. **Troubleshooting**
   - **"Resolution too low"**: Video must be at least 6K
   - **"Duration too long"**: Trim video to under 90 seconds
   - **"File too large"**: Compress video or reduce bitrate
   - **Upload fails**: Check WiFi connection and try again

### For Developers

1. **Install Dependencies**
   ```bash
   npm install expo-media-library
   ```

2. **Update Database Schema**
   - Run the SQL migration in Supabase dashboard (see above)

3. **Configure Supabase Storage**
   - Update file size limits to 2GB
   - Ensure sufficient storage quota

4. **Test Upload**
   - Use a test 6K video (under 90 seconds)
   - Verify validation works correctly
   - Confirm upload completes successfully
   - Check database record includes metadata

## Technical Details

### File Size Calculations

6K video file sizes (approximate):
- 30 seconds at 100 Mbps: ~375 MB
- 60 seconds at 100 Mbps: ~750 MB
- 90 seconds at 100 Mbps: ~1.1 GB
- 90 seconds at 150 Mbps: ~1.7 GB

### Resolution Standards

- **6K**: 6144x3160 (19.4 megapixels)
- **8K**: 7680x4320 (33.2 megapixels)
- **4K**: 3840x2160 (8.3 megapixels)
- **2K**: 2560x1440 (3.7 megapixels)

### Upload Method

The implementation uses `FileSystem.uploadAsync` with multipart upload:
- Supports files up to 2GB
- Progress tracking
- Automatic retry on network errors
- Session-based authentication

## Cost Considerations

### Supabase Storage Costs

**Free Tier** (Not sufficient):
- 1GB total storage
- 50MB per file
- 2GB bandwidth per month

**Pro Tier** (Recommended):
- 100GB total storage ($0.021/GB after)
- 5GB per file
- 200GB bandwidth per month ($0.09/GB after)
- Cost: $25/month

### Estimated Monthly Costs

Assuming 30 videos per month at 1.5GB each:
- Storage: 45GB (included in Pro tier)
- Bandwidth: ~90GB for downloads (included in Pro tier)
- **Total: $25/month** (Pro tier subscription)

If exceeding Pro tier limits:
- Additional storage: 45GB × $0.021 = $0.95/month
- Additional bandwidth: 0GB × $0.09 = $0/month

## Future Enhancements

### Potential Improvements

1. **Server-Side Validation**
   - Create Supabase Edge Function to re-validate videos
   - Prevent bypassing client-side validation

2. **Video Transcoding**
   - Automatically create lower-resolution versions
   - Optimize for different devices and connections

3. **Chunked Upload**
   - Split large files into chunks
   - Resume interrupted uploads
   - Better progress tracking

4. **Background Upload**
   - Allow uploads to continue when app is backgrounded
   - Notify user when upload completes

5. **Compression**
   - In-app video compression
   - Reduce file size while maintaining quality

6. **CDN Integration**
   - Use CDN for faster video delivery
   - Reduce bandwidth costs

## Testing Checklist

### Before Deployment

- [ ] Database migration applied
- [ ] Supabase storage configured (2GB limit)
- [ ] Supabase Pro tier activated
- [ ] Test video prepared (6K, under 90 seconds)
- [ ] WiFi connection available

### Testing Steps

1. [ ] Select 6K video - validation passes
2. [ ] Select 4K video - validation fails (resolution)
3. [ ] Select 6K video over 90 seconds - validation fails (duration)
4. [ ] Select 6K video over 2GB - validation fails (file size)
5. [ ] Upload valid 6K video - completes successfully
6. [ ] Verify database record includes metadata
7. [ ] Verify video plays in app
8. [ ] Test on slow connection - progress updates correctly
9. [ ] Test network interruption - error handling works

### Post-Deployment

- [ ] Monitor storage usage
- [ ] Monitor bandwidth usage
- [ ] Check upload success rate
- [ ] Gather user feedback
- [ ] Optimize based on metrics

## Support

### Common Issues

**Q: Upload fails with "Payload too large"**
A: Ensure Supabase storage is configured for 2GB files and you're on Pro tier.

**Q: Validation says "Could not read video information"**
A: Video format may not be supported. Try converting to MP4 (H.264).

**Q: Upload takes too long**
A: 6K videos are large. Ensure fast WiFi connection. Upload may take 10-15 minutes.

**Q: App crashes during upload**
A: Ensure device has sufficient memory. Close other apps during upload.

**Q: Video quality is poor after upload**
A: Supabase stores original file. Check video player settings and network speed.

### Contact

For issues or questions:
1. Check console logs for detailed errors
2. Verify all requirements are met
3. Test with smaller video first
4. Contact support with error details

## Summary

This implementation provides:
- ✅ Strict 6K resolution validation
- ✅ 90-second duration limit
- ✅ 2GB file size support
- ✅ Real-time validation feedback
- ✅ Detailed metadata storage
- ✅ Progress tracking for large uploads
- ✅ User-friendly error messages
- ✅ Professional admin experience

**Next Steps**:
1. Run database migration
2. Configure Supabase storage
3. Upgrade to Pro tier
4. Test with 6K video
5. Deploy to production
