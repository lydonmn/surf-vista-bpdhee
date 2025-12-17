
# Fix Video Upload Error - Missing duration_seconds Column

## Problem
You're getting this error when uploading videos:
```
Failed to upload video. Could not find the 'duration_seconds' column of 'videos' in the schema cache
```

## Solution
The `videos` table is missing the metadata columns needed for 6K video support. You need to run a database migration to add these columns.

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### 2. Run the Migration SQL
Copy and paste the following SQL into the editor and click "Run":

```sql
-- Add metadata columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Add comments to document the columns
COMMENT ON COLUMN videos.duration_seconds IS 'Video duration in seconds (decimal for precise timing)';
COMMENT ON COLUMN videos.resolution_width IS 'Video width in pixels (e.g., 6144 for 6K)';
COMMENT ON COLUMN videos.resolution_height IS 'Video height in pixels (e.g., 3456 for 6K)';
COMMENT ON COLUMN videos.file_size_bytes IS 'File size in bytes (supports up to 3GB files)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_duration ON videos(duration_seconds);
CREATE INDEX IF NOT EXISTS idx_videos_resolution ON videos(resolution_width, resolution_height);
```

### 3. Verify the Migration
Run this query to verify the columns were added:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'videos'
ORDER BY ordinal_position;
```

You should see the new columns:
- `duration_seconds` (numeric)
- `resolution_width` (integer)
- `resolution_height` (integer)
- `file_size_bytes` (bigint)

### 4. Test Video Upload
1. Go back to your app
2. Navigate to the Admin Panel
3. Try uploading a video again
4. The upload should now work without the error!

## What These Columns Do

- **duration_seconds**: Stores the exact video duration in seconds (e.g., 45.5 for 45.5 seconds)
- **resolution_width**: Stores the video width in pixels (e.g., 6144 for 6K video)
- **resolution_height**: Stores the video height in pixels (e.g., 3456 for 6K video)
- **file_size_bytes**: Stores the file size in bytes (supports files up to 3GB)

These columns allow the app to:
- Display accurate video metadata to users
- Filter videos by resolution
- Show file sizes and durations
- Support high-resolution 6K video uploads

## Troubleshooting

### If you get a "column already exists" error:
This is fine! It means the column was already added. The `IF NOT EXISTS` clause prevents errors if the column is already there.

### If you get a permission error:
Make sure you're logged in as the project owner or have admin access to the database.

### If the upload still fails:
1. Check that the migration ran successfully
2. Refresh your app (close and reopen)
3. Try uploading a different video
4. Check the browser console for any additional error messages

## Next Steps

After running this migration, your video upload feature will work correctly with full 6K video support!
