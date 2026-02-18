
# Mux Edge Functions Deployment Guide

## ✅ Files Created
- `supabase/functions/mux-create-upload/index.ts`
- `supabase/functions/mux-asset-status/index.ts`

## 📋 Deployment Steps

### 1. Set Supabase Secrets
You need to configure your Mux credentials as Supabase secrets. Use the Supabase CLI or Dashboard:

**Using Supabase CLI:**
```bash
supabase secrets set MUX_TOKEN_ID="73be518d-c6bf-4c20-8bfa-e040ce130abc"
supabase secrets set MUX_TOKEN_SECRET="B/dfF7i3gvbxqrm5Rjqjeqn3WTDS8oWxm/HXvl6Of+st3zK08yD41jT/MOQJGNveTVyylB7qZ2W"
```

**Using Supabase Dashboard:**
1. Go to your project dashboard
2. Navigate to Settings → Edge Functions
3. Add secrets:
   - Key: `MUX_TOKEN_ID`, Value: `73be518d-c6bf-4c20-8bfa-e040ce130abc`
   - Key: `MUX_TOKEN_SECRET`, Value: `B/dfF7i3gvbxqrm5Rjqjeqn3WTDS8oWxm/HXvl6Of+st3zK08yD41jT/MOQJGNveTVyylB7qZ2W`

### 2. Deploy Edge Functions
Deploy both functions using the Supabase CLI:

```bash
# Deploy mux-create-upload function
supabase functions deploy mux-create-upload --no-verify-jwt

# Deploy mux-asset-status function
supabase functions deploy mux-asset-status --no-verify-jwt
```

**Note:** `--no-verify-jwt` is used because these functions don't require authentication. If you want to protect them, remove this flag and add authentication to your frontend calls.

### 3. Get Your Function URLs
After deployment, your functions will be available at:
- `https://<your-project-ref>.supabase.co/functions/v1/mux-create-upload`
- `https://<your-project-ref>.supabase.co/functions/v1/mux-asset-status`

Replace `<your-project-ref>` with your actual Supabase project reference ID.

## 🧪 Testing the Functions

### Test mux-create-upload
```bash
curl -X POST 'https://<your-project-ref>.supabase.co/functions/v1/mux-create-upload' \
  -H 'Authorization: Bearer <your-anon-key>' \
  -H 'Content-Type: application/json'
```

Expected response:
```json
{
  "id": "upload-id-here",
  "url": "https://storage.googleapis.com/..."
}
```

### Test mux-asset-status
```bash
curl -X GET 'https://<your-project-ref>.supabase.co/functions/v1/mux-asset-status?uploadId=<upload-id>' \
  -H 'Authorization: Bearer <your-anon-key>'
```

Expected response (when ready):
```json
{
  "status": "ready",
  "asset_id": "asset-id-here",
  "playback_id": "playback-id-here",
  "hls_url": "https://stream.mux.com/<playback-id>.m3u8"
}
```

## 📱 Frontend Integration

Update your `app/admin.tsx` to use these functions:

```typescript
// Create upload URL
const createResponse = await fetch(
  `${SUPABASE_URL}/functions/v1/mux-create-upload`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  }
);
const { id: uploadId, url: uploadUrl } = await createResponse.json();

// Upload video to Mux
await fetch(uploadUrl, {
  method: 'PUT',
  body: videoFile,
  headers: {
    'Content-Type': 'video/*',
  },
});

// Poll for status
const checkStatus = async () => {
  const statusResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/mux-asset-status?uploadId=${uploadId}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const { status, hls_url } = await statusResponse.json();
  
  if (status === 'ready' && hls_url) {
    // Save hls_url to your database
    return hls_url;
  } else if (status === 'waiting') {
    // Poll again after a delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    return checkStatus();
  }
};
```

## 🔍 Troubleshooting

### Function returns "Mux API credentials not configured"
- Verify secrets are set correctly in Supabase Dashboard
- Redeploy functions after setting secrets

### Function returns 401/403 errors
- Check your Mux credentials are correct
- Verify the credentials have proper permissions in Mux dashboard

### Upload status stays "waiting"
- Video may still be processing (can take several minutes for large files)
- Check Mux dashboard for upload/asset status
- Verify the upload to the Mux URL completed successfully

## 📚 API Reference

### mux-create-upload
- **Method:** POST
- **Returns:** `{ id: string, url: string }`
- **Description:** Creates a Mux direct upload URL

### mux-asset-status
- **Method:** GET or POST
- **Query Param:** `uploadId` (for GET)
- **Body:** `{ uploadId: string }` (for POST)
- **Returns:** 
  - `{ status: 'waiting' }` - Asset not yet created
  - `{ status: string, asset_id: string, playback_id: string, hls_url: string }` - Asset ready

## ✅ Deployment Checklist
- [ ] Secrets configured in Supabase
- [ ] Both functions deployed successfully
- [ ] Test mux-create-upload returns upload URL
- [ ] Test mux-asset-status with a real upload ID
- [ ] Frontend updated to use new functions
- [ ] Video upload flow tested end-to-end
