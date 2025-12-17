
# 6K Video Upload - Complete Setup Guide

## ✅ Implementation Complete

Your SurfVista app now supports **6K video uploads up to 90 seconds** with the following features:

### Features Implemented

1. **Video Validation**
   - Minimum resolution: 6K (6144x3160)
   - Maximum duration: 90 seconds
   - Maximum file size: 3GB
   - Real-time validation with detailed feedback

2. **Smart Upload System**
   - Progress tracking with percentage display
   - Multipart upload for large files
   - Automatic retry on network errors
   - Detailed error messages

3. **Metadata Storage**
   - Resolution (width x height)
   - Duration (seconds)
   - File size (bytes)
   - Upload timestamp

4. **User Experience**
   - Visual validation feedback (green = pass, red = fail)
   - Clear requirements display
   - Upload progress indicator
   - Helpful tips and warnings

## 🚀 Quick Start

### Step 1: Configure Supabase Storage

**IMPORTANT**: You must configure your Supabase storage bucket before uploading 6K videos.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `ucbilksfpnmltrkwvzft`
3. Navigate to **Storage** → **videos** bucket
4. Click **Settings** (gear icon)
5. Set **Maximum file size** to: `3221225472` bytes (3GB)
6. Save changes

### Step 2: Update Database Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Add video metadata columns (if not already added)
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Update constraints for 3GB max file size
ALTER TABLE videos 
DROP CONSTRAINT IF EXISTS check_file_size;

ALTER TABLE videos 
ADD CONSTRAINT check_file_size 
CHECK (file_size_bytes IS NULL OR file_size_bytes <= 3221225472);

-- Verify changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name IN ('resolution_width', 'resolution_height', 'duration_seconds', 'file_size_bytes');
```

### Step 3: Test Upload

1. Open your app
2. Navigate to **Admin Panel**
3. Scroll to **Upload 6K Video** section
4. Click **Select Video**
5. Choose a 6K video (under 90 seconds)
6. Wait for validation
7. Enter a title
8. Click **Upload 6K Video**
9. Wait for upload to complete (may take 5-15 minutes)

## 📋 Requirements Checklist

Before uploading 6K videos, ensure:

- [ ] Supabase storage bucket configured for 3GB max file size
- [ ] Database schema updated with metadata columns
- [ ] Supabase Pro plan or higher (Free plan limited to 50MB)
- [ ] Stable WiFi connection for uploads
- [ ] Video meets requirements:
  - [ ] Resolution: 6K or higher (6144x3160 minimum)
  - [ ] Duration: 90 seconds or less
  - [ ] File size: 3GB or less
  - [ ] Format: MP4, MOV, or other supported video format

## 🎥 Video Recording Tips

To record 6K videos for SurfVista:

### iPhone (iPhone 12 Pro or newer)
1. Open **Settings** → **Camera**
2. Select **Record Video**
3. Choose **4K at 60 fps** or higher
4. For 6K, use third-party apps like:
   - **Filmic Pro**
   - **ProCam**
   - **MoviePro**

### Android (Samsung S21 or newer)
1. Open **Camera** app
2. Go to **Settings** → **Video size**
3. Select **8K** or **6K** (if available)
4. For 6K, use third-party apps like:
   - **Cinema FV-5**
   - **Open Camera**
   - **Filmic Pro**

### Drone (DJI or similar)
1. Set video resolution to **6K** or **5.4K**
2. Set frame rate to **30fps** or **60fps**
3. Use **H.265 (HEVC)** codec for smaller file sizes
4. Keep flights under 90 seconds for surf reports

### Video Editing
To optimize 6K videos before upload:

1. **Compress with HandBrake**:
   - Preset: "Fast 1080p30" or "Fast 2160p60"
   - Codec: H.265 (HEVC)
   - Quality: RF 22-28
   - Target file size: Under 1.5GB

2. **Trim to 90 seconds**:
   - Use iMovie, Final Cut Pro, or Adobe Premiere
   - Keep only the best footage
   - Add titles/overlays if needed

3. **Export settings**:
   - Resolution: 6K (6144x3160) or higher
   - Frame rate: 30fps or 60fps
   - Codec: H.265 (HEVC)
   - Bitrate: 50-100 Mbps

## 🔧 Troubleshooting

### Error: "Payload too large" (413)

**Cause**: Storage bucket file size limit is too low

**Solution**:
1. Go to Supabase Dashboard
2. Storage → videos bucket → Settings
3. Increase "Maximum file size" to 3GB (3221225472 bytes)
4. Save and try again

### Error: "Video Does Not Meet Requirements"

**Cause**: Video doesn't meet 6K requirements

**Solution**:
- Check resolution: Must be at least 6144x3160
- Check duration: Must be 90 seconds or less
- Check file size: Must be 3GB or less
- Re-record or re-export video with correct settings

### Error: "Network request failed"

**Cause**: Poor internet connection or timeout

**Solution**:
- Use a stable WiFi connection
- Avoid cellular data for large uploads
- Try again during off-peak hours
- Keep app open during upload

### Upload takes too long

**Expected behavior**: 6K videos can take 5-15 minutes to upload

**Tips**:
- Use fastest available WiFi
- Keep app in foreground
- Don't lock phone during upload
- Compress video before upload to reduce file size

### Video won't play after upload

**Cause**: Video format not supported by browser/device

**Solution**:
- Re-export video as MP4 with H.264 codec
- Ensure video is not corrupted
- Check video URL in database
- Test video playback in browser

## 📊 File Size Estimates

| Resolution | Duration | Bitrate | File Size | Upload Time (50 Mbps WiFi) |
|------------|----------|---------|-----------|----------------------------|
| 6K | 30 sec | 100 Mbps | ~375 MB | ~1 minute |
| 6K | 60 sec | 100 Mbps | ~750 MB | ~2 minutes |
| 6K | 90 sec | 100 Mbps | ~1.1 GB | ~3 minutes |
| 6K | 90 sec | 150 Mbps | ~1.7 GB | ~5 minutes |
| 6K | 90 sec | 200 Mbps | ~2.2 GB | ~7 minutes |

## 🎯 Best Practices

1. **Record in good lighting**: Better quality, smaller file sizes
2. **Use stabilization**: Reduces motion blur and file size
3. **Compress before upload**: Use H.265 codec for 30-50% smaller files
4. **Test with small videos first**: Verify setup works before uploading large files
5. **Upload during off-peak hours**: Faster upload speeds
6. **Keep videos under 60 seconds**: Faster uploads, better user experience
7. **Monitor storage usage**: Check Supabase dashboard regularly

## 📱 User Experience

### Admin Upload Flow
1. Admin opens Admin Panel
2. Sees clear requirements and warnings
3. Selects video from library
4. App validates video automatically
5. Shows validation results with color coding
6. Enters title and description
7. Uploads video with progress tracking
8. Receives success confirmation

### Subscriber View Flow
1. Subscriber opens Videos tab
2. Sees list of uploaded videos
3. Taps video to watch
4. Video plays in full-screen player
5. Can see video metadata (resolution, duration)

## 🔐 Security

- Only admins can upload videos
- Videos stored in public bucket for subscriber access
- Row Level Security (RLS) enforced on database
- File size limits prevent abuse
- Validation prevents invalid uploads

## 💰 Cost Considerations

### Supabase Storage Costs (Pro Plan)
- Storage: $0.021 per GB per month
- Bandwidth: $0.09 per GB

### Example Monthly Costs
- 10 videos × 1GB each = 10GB storage = $0.21/month
- 100 subscribers × 10 videos × 1GB = 1TB bandwidth = $90/month

**Recommendation**: Monitor usage and upgrade plan as needed

## 📈 Next Steps

1. ✅ Configure Supabase storage (3GB max file size)
2. ✅ Update database schema
3. ✅ Test upload with small 6K video
4. ✅ Test upload with full 90-second video
5. ✅ Verify video playback
6. ✅ Monitor storage usage
7. ✅ Set up automated backups
8. ✅ Configure CDN for faster delivery (optional)

## 🆘 Support

If you need help:
1. Check error messages in app
2. Review Supabase logs: Dashboard → Logs → Storage
3. Check this guide for troubleshooting
4. Contact Supabase support for plan limits
5. Review video format compatibility

## 🎉 Success!

Your SurfVista app now supports professional-quality 6K video uploads for daily surf reports. Subscribers will love the high-resolution drone footage!

**Happy surfing! 🏄‍♂️🌊**
