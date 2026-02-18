
# 🎬 Video Transcoding Implementation Guide

## 📋 Current Video Upload Pipeline

### **Location:** `app/admin.tsx`

### **Upload Flow:**
1. **Video Selection** - Admin selects video from device using `expo-image-picker`
2. **Validation** - Checks file size (max 10GB) and duration (max 10 minutes)
3. **TUS Upload** - Uploads to Supabase Storage using resumable TUS protocol (15MB chunks)
4. **Thumbnail Generation** - Creates thumbnail using `expo-video-thumbnails`
5. **Database Record** - Saves metadata to `videos` table

### **The Problem:**
- Videos uploaded at **original quality** (6K resolution, 300MB+ files)
- Causes constant buffering during playback
- Poor user experience on slower connections
- High bandwidth costs

---

## ✅ Solution Implemented: Server-Side Transcoding

### **What Was Added:**

#### 1. **Supabase Edge Function: `transcode-video`**
   - **Endpoint:** `POST /functions/v1/transcode-video`
   - **Authentication:** Requires Bearer token (JWT)
   - **Purpose:** Compresses videos after upload to reduce file size

#### 2. **Frontend Integration** (app/admin.tsx)
   - After video uploads to Supabase Storage, the app calls the transcoding function
   - Transcoding happens asynchronously in the background
   - If transcoding fails, the original video is still available

---

## 🔧 How It Works

### **Current Implementation (Placeholder):**

```typescript
// In app/admin.tsx - after video upload completes
const transcodeResponse = await fetch(`${supabaseUrl}/functions/v1/transcode-video`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    videoUrl: urlData.publicUrl,
    fileName: fileName,
    targetResolution: '1080p',
    targetBitrate: '2500k',
  }),
});
```

### **Edge Function Flow:**
1. ✅ Authenticates the user
2. ✅ Downloads original video from Supabase Storage
3. ⚠️ **PLACEHOLDER:** Transcodes video (needs actual implementation)
4. ✅ Uploads compressed video back to Supabase
5. ✅ Returns compressed video URL and compression stats

---

## 🚀 Production Implementation Options

The current Edge Function is a **placeholder**. To implement actual video transcoding, choose one of these options:

### **Option 1: Cloud Transcoding Service (Recommended)**

Use a managed service like:
- **AWS MediaConvert** - Professional video transcoding
- **Google Cloud Transcoder API** - Scalable video processing
- **Cloudflare Stream** - Built-in transcoding + CDN
- **Mux** - Video infrastructure with automatic transcoding

**Pros:**
- ✅ No server maintenance
- ✅ Handles all video formats
- ✅ Automatic scaling
- ✅ Fast processing

**Cons:**
- ❌ Additional cost per minute of video
- ❌ External dependency

### **Option 2: FFmpeg in Edge Function**

Deploy FFmpeg as a Deno layer or use `ffmpeg-wasm`:

```typescript
// Install ffmpeg-wasm in Edge Function
import { createFFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({ log: true });
await ffmpeg.load();

// Transcode video
ffmpeg.FS('writeFile', 'input.mp4', videoUint8Array);
await ffmpeg.run(
  '-i', 'input.mp4',
  '-vcodec', 'libx264',
  '-crf', '23',
  '-preset', 'medium',
  '-vf', 'scale=-2:1080',
  '-b:v', '2500k',
  '-acodec', 'aac',
  '-b:a', '128k',
  'output.mp4'
);
const compressedVideo = ffmpeg.FS('readFile', 'output.mp4');
```

**Pros:**
- ✅ Full control over transcoding
- ✅ No external dependencies
- ✅ Cost-effective

**Cons:**
- ❌ Slower processing (runs in browser/Deno)
- ❌ Limited by Edge Function timeout (varies by plan)
- ❌ Memory constraints

### **Option 3: Dedicated Transcoding Microservice**

Deploy a separate Node.js/Python service with FFmpeg:

```bash
# Docker container with FFmpeg
FROM node:18
RUN apt-get update && apt-get install -y ffmpeg
# ... rest of Dockerfile
```

**Pros:**
- ✅ Best performance
- ✅ No timeout limits
- ✅ Full FFmpeg capabilities

**Cons:**
- ❌ Requires separate hosting
- ❌ More infrastructure to manage

---

## 📊 Recommended Transcoding Settings

For optimal streaming performance:

```bash
ffmpeg -i input.mp4 \
  -vcodec libx264 \           # H.264 codec (universal compatibility)
  -crf 23 \                   # Quality (18-28, lower = better)
  -preset medium \            # Encoding speed vs compression
  -vf "scale=-2:1080" \       # Scale to 1080p (maintains aspect ratio)
  -b:v 2500k \                # Video bitrate (2.5 Mbps)
  -maxrate 3000k \            # Max bitrate
  -bufsize 5000k \            # Buffer size
  -acodec aac \               # Audio codec
  -b:a 128k \                 # Audio bitrate
  -movflags +faststart \      # Enable progressive download
  output.mp4
```

**Expected Results:**
- 6K 300MB video → 1080p ~50MB video (83% reduction)
- Smooth playback on 4G/5G connections
- No buffering on replay

---

## 🎯 Next Steps to Complete Implementation

### **Step 1: Choose Transcoding Method**
Pick one of the three options above based on your needs:
- **Quick & Easy:** Use AWS MediaConvert or Cloudflare Stream
- **Cost-Effective:** Implement FFmpeg in Edge Function
- **Best Performance:** Deploy dedicated transcoding service

### **Step 2: Update Edge Function**
Replace the placeholder transcoding logic in `transcode-video` Edge Function with actual video processing.

### **Step 3: Test & Monitor**
- Upload a test video
- Verify compression works
- Check playback quality
- Monitor processing time

### **Step 4: Optional Enhancements**
- **Async Processing:** Use a job queue for long videos
- **Multiple Qualities:** Generate 720p, 1080p, 4K versions
- **Progress Updates:** WebSocket for real-time transcoding progress
- **Automatic Cleanup:** Delete original after successful transcode

---

## 🔍 Current Status

✅ **Completed:**
- Edge Function deployed and ready
- Frontend integration added
- Error handling implemented
- Graceful fallback (uses original if transcoding fails)

⚠️ **Needs Implementation:**
- Actual video transcoding logic (currently placeholder)
- Choose and integrate transcoding method

---

## 💡 Quick Win: Use Cloudflare Stream

For the fastest implementation:

1. Sign up for Cloudflare Stream
2. Get API token
3. Update Edge Function to use Cloudflare API:

```typescript
// In transcode-video Edge Function
const cloudflareResponse = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
    },
    body: JSON.stringify({
      url: videoUrl,
      meta: { name: fileName },
    }),
  }
);

// Cloudflare automatically transcodes and returns optimized URL
const { result } = await cloudflareResponse.json();
return result.playback.hls; // Adaptive bitrate streaming URL
```

This gives you:
- ✅ Automatic transcoding
- ✅ Multiple quality levels
- ✅ CDN delivery
- ✅ Adaptive bitrate streaming
- ✅ ~5 minutes processing time

---

## 📞 Support

The transcoding infrastructure is ready. You just need to implement the actual video processing logic based on your preferred method above.

**Current behavior:** Videos upload successfully, transcoding is attempted but uses placeholder logic (no actual compression yet).

**To enable compression:** Implement one of the three options above in the `transcode-video` Edge Function.
