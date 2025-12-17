
# 6K Video Upload - Quick Reference

## ⚡ Quick Setup (5 minutes)

### 1. Configure Supabase Storage
```
Dashboard → Storage → videos bucket → Settings
Set "Maximum file size" to: 3221225472 bytes (3GB)
```

### 2. Update Database
```sql
-- Run in Supabase SQL Editor
ALTER TABLE videos DROP CONSTRAINT IF EXISTS check_file_size;
ALTER TABLE videos ADD CONSTRAINT check_file_size 
CHECK (file_size_bytes IS NULL OR file_size_bytes <= 3221225472);
```

### 3. Test Upload
```
Admin Panel → Upload 6K Video → Select Video → Upload
```

## 📋 Requirements

| Requirement | Value |
|-------------|-------|
| Min Resolution | 6K (6144x3160) |
| Max Duration | 90 seconds |
| Max File Size | 3GB |
| Recommended Size | Under 1.5GB |
| Format | MP4, MOV, MKV, WebM |
| Codec | H.264 or H.265 (HEVC) |

## 🎥 Recording Settings

### iPhone
- Settings → Camera → Record Video
- Select 4K at 60fps or higher
- Use Filmic Pro for 6K

### Android
- Camera → Settings → Video size
- Select 8K or 6K
- Use Cinema FV-5 for 6K

### Drone
- Resolution: 6K or 5.4K
- Frame rate: 30fps or 60fps
- Codec: H.265 (HEVC)

## 🔧 Common Issues

| Error | Solution |
|-------|----------|
| "Payload too large" | Increase storage bucket limit to 3GB |
| "Resolution too low" | Record in 6K or higher |
| "Duration too long" | Trim video to 90 seconds or less |
| "Network failed" | Use stable WiFi connection |

## 📊 File Size Guide

| Duration | Bitrate | File Size | Upload Time |
|----------|---------|-----------|-------------|
| 30 sec | 100 Mbps | ~375 MB | ~1 min |
| 60 sec | 100 Mbps | ~750 MB | ~2 min |
| 90 sec | 100 Mbps | ~1.1 GB | ~3 min |
| 90 sec | 150 Mbps | ~1.7 GB | ~5 min |

## ✅ Upload Checklist

- [ ] Supabase storage configured (3GB limit)
- [ ] Database updated (3GB constraint)
- [ ] Video is 6K or higher
- [ ] Video is 90 seconds or less
- [ ] File size is under 3GB
- [ ] Stable WiFi connection
- [ ] Supabase Pro plan or higher

## 💡 Pro Tips

1. **Compress videos**: Use HandBrake with H.265 codec
2. **Test first**: Upload small video before large ones
3. **Use WiFi**: Cellular data is slow and expensive
4. **Keep app open**: Don't lock phone during upload
5. **Monitor storage**: Check Supabase dashboard regularly

## 🆘 Need Help?

1. Check error message in app
2. Review Supabase logs
3. See full guide: `6K_VIDEO_SETUP_COMPLETE.md`
4. Contact Supabase support

## 🎯 Success Criteria

✅ Video uploads without errors
✅ Video plays in app
✅ Metadata stored correctly
✅ Subscribers can view video
✅ Upload time under 15 minutes

---

**Ready to upload 6K surf reports! 🏄‍♂️🌊**
