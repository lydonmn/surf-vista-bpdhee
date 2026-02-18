
# 🎥 SurfVista Video System - User Guide

## What's New?

Your SurfVista app now has a completely redesigned video system that provides:

### ⚡ Instant Playback
- Videos play immediately with zero buffering
- No more waiting for videos to load
- Smooth transitions between videos

### 📥 Background Downloading
- Videos download automatically in the background
- Downloads continue even when you minimize the app
- Next 2-3 videos are always ready to play

### 💾 Smart Caching
- Videos are saved locally after first view
- Replay instantly without re-downloading
- 500MB cache with automatic cleanup
- Oldest videos removed when cache is full

### 🔄 Seamless Experience
- Next video pre-buffers while current plays
- Zero delay when moving to next video
- Aggressive preloading when app returns to foreground

## How to Use

### Watching Videos

1. **First Time**: Video streams from network (may buffer briefly)
2. **Subsequent Views**: Instant playback from local cache
3. **Next Video**: Starts immediately (already pre-buffered)

### Video Controls

- **Tap Screen**: Show/hide controls
- **Play/Pause**: Center button or tap video
- **Seek**: Drag progress bar to jump to any point
- **Volume**: Adjust with volume slider
- **Fullscreen**: Tap fullscreen button (stays portrait for drone videos)

### Background Behavior

- **Minimize App**: Downloads continue in background
- **Return to App**: Preloading resumes aggressively
- **Lock Screen**: Downloads persist (iOS/Android)
- **Low Battery**: System may throttle downloads

## For Admins

### Cache Management

Access: **Admin Debug → Video Cache**

View:
- Total cache size (MB)
- Number of cached files
- Cache usage percentage

Actions:
- Clear all cached videos
- View detailed statistics
- Monitor cache health

### Best Practices

1. **Monitor Cache**: Check cache size periodically
2. **Clear When Needed**: Clear cache if storage is low
3. **WiFi Recommended**: Large 6K videos download faster on WiFi
4. **Battery Aware**: Background downloads may be throttled on low battery

## Technical Details

### Video Formats Supported
- HLS (.m3u8) - Adaptive streaming
- MP4 - Direct playback
- All videos must use HTTPS

### Cache Specifications
- **Location**: Device cache directory
- **Max Size**: 500MB
- **Eviction**: Least Recently Used (LRU)
- **Naming**: MD5 hash of URL

### Platform Differences

**iOS:**
- Uses background fetch and processing modes
- System controls background task scheduling
- May throttle based on battery and usage patterns

**Android:**
- Uses WorkManager for background tasks
- More aggressive background downloading
- Requires WAKE_LOCK permission

## Troubleshooting

### Videos Not Playing Instantly

**Check:**
1. Is this the first time watching? (Will stream from network)
2. Was cache cleared recently?
3. Is device storage full?

**Solution:**
- Wait for video to download once
- Subsequent views will be instant

### Downloads Not Working in Background

**iOS:**
- Check Settings → SurfVista → Background App Refresh (must be ON)
- System may throttle downloads on low battery
- Background downloads prioritized on WiFi

**Android:**
- Check battery optimization settings
- Ensure app is not restricted
- Background downloads should work reliably

### Cache Full

**Symptoms:**
- Oldest videos removed automatically
- May need to re-download some videos

**Solution:**
- Go to Admin Debug → Video Cache
- Clear cache to start fresh
- Videos will re-download as needed

### Playback Errors

**Common Issues:**
1. **Network Error**: Check internet connection
2. **Invalid URL**: Video may have been deleted
3. **Format Not Supported**: Must be HLS or MP4

**Solution:**
- Pull down to refresh video list
- Try again in a few moments
- Contact support if persists

## Performance Tips

### For Best Experience:

1. **WiFi**: Download videos on WiFi for faster caching
2. **Foreground**: Keep app open while first video downloads
3. **Storage**: Ensure device has adequate free space
4. **Battery**: Charge device for optimal background downloading

### What to Expect:

- **First Video**: May buffer briefly (downloading)
- **Second View**: Instant playback (cached)
- **Next Videos**: Pre-buffered (zero delay)
- **Queue**: Smooth transitions between videos

## Privacy & Storage

### Data Storage
- Videos stored in device cache (not permanent storage)
- Cache can be cleared anytime
- No videos uploaded to cloud from cache

### Permissions
- **iOS**: Background fetch and processing
- **Android**: Wake lock and foreground service
- All permissions used only for video downloading

### Security
- All video URLs use HTTPS
- Signed URLs with expiration
- Local cache encrypted by device

## Support

### Need Help?

1. Check this guide first
2. Try clearing cache (Admin Debug → Video Cache)
3. Pull down to refresh video list
4. Contact support with specific error messages

### Reporting Issues

Include:
- Device type (iPhone/Android)
- iOS/Android version
- Specific video that failed
- Error message if shown
- Steps to reproduce

## Future Enhancements

Coming soon:
- Download progress UI in video list
- WiFi-only download option
- Selective video caching
- Cache size preferences
- Download queue management
