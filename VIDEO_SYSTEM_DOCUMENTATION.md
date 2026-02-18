
# 🎥 SurfVista Video System - Background Downloading & Instant Playback

## Overview

The SurfVista video system implements true background downloading and seamless instant playback for 6K drone footage. Videos are downloaded in the background (even when the app is minimized) and played instantly from local cache.

## Architecture

### 1. **VideoDownloadManager Service** (`services/VideoDownloadManager.ts`)

A singleton service that manages all video downloads and caching:

- **Background Downloading**: Uses `react-native-background-downloader` to download videos even when app is backgrounded
- **LRU Cache**: Maintains a 500MB cache with Least Recently Used eviction
- **Consistent Naming**: Videos are stored with MD5 hash of URL for consistent retrieval
- **Cache Directory**: `FileSystem.cacheDirectory/videos/`

**Key Methods:**
```typescript
VideoDownloadManager.preloadVideo(url: string): Promise<void>
VideoDownloadManager.getLocalPathIfCached(url: string): Promise<string | null>
VideoDownloadManager.clearCache(): Promise<void>
VideoDownloadManager.getCacheStats(): Promise<{ totalSize: number; fileCount: number }>
```

### 2. **useVideoPreloader Hook** (`hooks/useVideoPreloader.ts`)

React hook that manages the video preload queue:

- **Preload Queue**: Automatically preloads 2-3 videos ahead
- **AppState Integration**: Resumes aggressive preloading when app returns to foreground
- **Source Selection**: Returns local file:// path if cached, otherwise remote URL
- **Progress Tracking**: Monitors download progress for each video

**Usage:**
```typescript
const { getSource, isPreloading, preloadProgress } = useVideoPreloader(videoUrls);
const source = getSource(videoUrl); // Returns { uri: 'file://...' } or { uri: 'https://...' }
```

### 3. **useVideoQueue Hook** (`hooks/useVideoQueue.ts`)

Manages a queue of videos for a location:

- **Queue Management**: Loads all videos for a location
- **Navigation**: Next/previous video controls
- **Auto-refresh**: Reloads when location changes

**Usage:**
```typescript
const { videos, currentIndex, nextVideo, previousVideo } = useVideoQueue(locationId);
```

### 4. **OptimizedVideoPlayer Component** (`components/OptimizedVideoPlayer.tsx`)

Reusable video player component with optimized settings:

- **react-native-video**: Uses the battle-tested react-native-video library
- **Platform-specific Buffer Config**:
  - Android: `bufferForPlaybackMs: 1000`, `minBufferMs: 2500`
  - iOS: `automaticallyWaitsToMinimizeStalling: false`
- **Poster Images**: Shows thumbnail to prevent blank frames
- **Custom Controls**: Full playback controls with auto-hide

### 5. **Enhanced Video Player Screens**

Two video player implementations:

- **video-player-v2.tsx**: Full-featured player with preloading and queue support
- **video-player-enhanced.tsx**: Alternative implementation with additional features

Both support:
- ✅ Instant playback from local cache
- ✅ Pre-buffering next video off-screen
- ✅ Fullscreen mode with portrait lock
- ✅ Custom controls with auto-hide
- ✅ Progress tracking and seeking
- ✅ Volume control
- ✅ Error recovery

## Platform Configuration

### iOS (app.json)

```json
"UIBackgroundModes": [
  "remote-notification",
  "fetch",
  "processing"
],
"BGTaskSchedulerPermittedIdentifiers": [
  "Therealfollysurfreport.SurfVista.video-download"
]
```

### Android (app.json)

```json
"permissions": [
  "WAKE_LOCK",
  "FOREGROUND_SERVICE"
]
```

## Data Flow

1. **App Startup**: VideoDownloadManager initializes, loads existing cache
2. **Video List Load**: useVideoQueue fetches videos for current location
3. **Preload Queue**: useVideoPreloader starts downloading next 2-3 videos
4. **Playback**: Player checks for local file first, falls back to remote URL
5. **Pre-buffering**: Next video is mounted off-screen with `paused={true}`
6. **Background**: Downloads continue even when app is minimized
7. **Foreground Resume**: Preloading resumes aggressively when app returns

## Performance Optimizations

### Instant Playback
- Local files play immediately (no network latency)
- Pre-buffered next video eliminates loading between videos
- Optimized buffer settings reduce initial buffering time

### Background Downloading
- Downloads persist through app backgrounding
- iOS background fetch and processing modes
- Android WorkManager for reliable background tasks

### Cache Management
- 500MB maximum cache size
- LRU eviction when limit reached
- Automatic cleanup of old videos

### Network Efficiency
- Videos downloaded once, played many times
- Reduces bandwidth usage for repeat views
- HLS (.m3u8) support for adaptive streaming

## Usage Examples

### Basic Video Playback
```typescript
import { useVideoPreloader } from '@/hooks/useVideoPreloader';

function MyVideoScreen() {
  const videoUrls = ['https://...video1.m3u8', 'https://...video2.m3u8'];
  const { getSource } = useVideoPreloader(videoUrls);
  
  return (
    <Video
      source={getSource(videoUrls[0])}
      poster="https://...thumbnail.jpg"
      // ... other props
    />
  );
}
```

### With Queue Management
```typescript
import { useVideoQueue } from '@/hooks/useVideoQueue';
import { useVideoPreloader } from '@/hooks/useVideoPreloader';

function VideoGallery({ locationId }: { locationId: string }) {
  const { videos, currentIndex, nextVideo } = useVideoQueue(locationId);
  const videoUrls = videos.map(v => v.video_url);
  const { getSource } = useVideoPreloader(videoUrls);
  
  const currentVideo = videos[currentIndex];
  
  return (
    <Video
      source={getSource(currentVideo.video_url)}
      onEnd={nextVideo}
      // ... other props
    />
  );
}
```

### Manual Cache Management
```typescript
import { VideoDownloadManager } from '@/services/VideoDownloadManager';

// Clear all cached videos
await VideoDownloadManager.clearCache();

// Get cache statistics
const stats = await VideoDownloadManager.getCacheStats();
console.log('Cache size:', stats.totalSize / 1024 / 1024, 'MB');
console.log('Files cached:', stats.fileCount);

// Manually preload a video
await VideoDownloadManager.preloadVideo('https://...video.m3u8');

// Check if video is cached
const localPath = await VideoDownloadManager.getLocalPathIfCached('https://...video.m3u8');
if (localPath) {
  console.log('Video is cached at:', localPath);
}
```

## Troubleshooting

### Videos Not Downloading in Background

**iOS:**
- Verify `UIBackgroundModes` includes `fetch` and `processing` in app.json
- Check `BGTaskSchedulerPermittedIdentifiers` is configured
- Background downloads may be throttled by iOS based on battery and network conditions

**Android:**
- Verify `WAKE_LOCK` and `FOREGROUND_SERVICE` permissions in app.json
- WorkManager handles background tasks automatically
- Check device battery optimization settings

### Playback Issues

1. **Check cache first**: Use `VideoDownloadManager.getLocalPathIfCached(url)`
2. **Verify URL format**: Must be HTTPS and valid HLS (.m3u8) or MP4
3. **Check buffer config**: Android requires specific buffer settings
4. **Monitor logs**: Look for `[VideoDownloadManager]` and `[useVideoPreloader]` logs

### Cache Not Evicting

- Cache eviction triggers when total size exceeds 500MB
- LRU algorithm removes oldest accessed files first
- Manual clear: `VideoDownloadManager.clearCache()`

## Best Practices

1. **Always use getSource()**: Never hardcode video URLs, always use `getSource(url)` from useVideoPreloader
2. **Preload ahead**: Keep 2-3 videos in the preload queue for smooth transitions
3. **Show poster images**: Always provide thumbnail URLs to prevent blank frames
4. **Handle errors gracefully**: Implement error callbacks and retry logic
5. **Monitor cache size**: Periodically check cache stats and clear if needed
6. **Test on device**: Background downloading behavior differs between simulator and real devices

## Migration from expo-video

The system uses `react-native-video` instead of `expo-video` for better control over buffering and caching. Key differences:

- **Buffer Config**: react-native-video allows fine-tuned buffer settings
- **Background Support**: Better integration with background download system
- **Platform Optimization**: Separate configs for iOS and Android
- **Poster Support**: Built-in poster/thumbnail support

## Future Enhancements

- [ ] Download progress UI in video list
- [ ] Selective download (user chooses which videos to cache)
- [ ] WiFi-only download option
- [ ] Cache size user preference
- [ ] Download queue priority management
- [ ] Bandwidth throttling for background downloads
