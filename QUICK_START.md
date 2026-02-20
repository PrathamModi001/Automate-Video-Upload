# Quick Start - Copy & Paste Curl Commands

## 🚀 Start Server

```bash
cd E:\LMS\video-upload-server
npm run dev
```

Wait for this message:
```
✅ MongoDB Connected
🚀 Video Upload Server started successfully
   Port: 4000
```

---

## 📋 Copy-Paste Curl Commands

### 1. Health Check ✅
```bash
curl http://localhost:4000/health
```

---

### 2. Get Pending Upload Activities 📋
```bash
curl -H "x-api-key: video-upload-server-secure-key-2026" http://localhost:4000/api/activities/pending-uploads
```

**Pretty Print (with Python):**
```bash
curl -s -H "x-api-key: video-upload-server-secure-key-2026" http://localhost:4000/api/activities/pending-uploads | python -m json.tool
```

---

### 3. Upload Single Activity 🎬
```bash
# Replace ACTIVITY_ID with actual ID from step 2
curl -X POST -H "x-api-key: video-upload-server-secure-key-2026" http://localhost:4000/api/upload/activity/ACTIVITY_ID
```

**Example:**
```bash
curl -X POST -H "x-api-key: video-upload-server-secure-key-2026" http://localhost:4000/api/upload/activity/6995afd8166cbed703925081
```

---

### 4. Process Next Pending Upload (One at a Time) ⏭️
```bash
curl -X POST -H "x-api-key: video-upload-server-secure-key-2026" http://localhost:4000/api/upload/process-next
```

---

## 🔑 Authentication Setup (Already Done!)

✅ The `.env` already has the `HEADERSAPIKEY` copied from main backend!

No need to login or get JWT tokens - this server uses the same API key authentication as the main backend for automated operation.

---

## 🧪 Test Complete Flow

```bash
# Step 1: Check server health
curl http://localhost:4000/health

# Step 2: Get list of pending uploads
curl -s -H "x-api-key: video-upload-server-secure-key-2026" \
  http://localhost:4000/api/activities/pending-uploads | python -m json.tool

# Step 3: Copy an activity ID from the response

# Step 4: Upload that activity (replace ACTIVITY_ID)
curl -X POST \
  -H "x-api-key: video-upload-server-secure-key-2026" \
  http://localhost:4000/api/upload/activity/ACTIVITY_ID

# Or just process the next one automatically
curl -X POST \
  -H "x-api-key: video-upload-server-secure-key-2026" \
  http://localhost:4000/api/upload/process-next
```

---

## ⚠️ Before Testing Upload

1. ✅ **HEADERSAPIKEY already set in `.env`** (copied from main backend)
2. **Ensure MongoDB is connected** (check server logs)
3. **Verify Bunny Stream credentials** in `.env`
4. **Have enough disk space** in `./uploads/` folder

---

## 📊 Monitor Progress

Watch server console output - it shows detailed progress:
```
================================================================================
🎬 STARTING UPLOAD FOR ACTIVITY: 6995afd8166cbed703925081
================================================================================

📋 Step 1: Fetching activity details...
   ✅ Activity: Machine Learning Basics
   ✅ Course: AI Fundamentals

📥 Step 2: Updating status to 'downloading'...

🔗 Step 3: Getting recording URL from 100ms...
   ✅ Recording URL obtained

⬇️  Step 4: Downloading video to NEW server...
   Download progress: 45.32%

...
```

---

## 🔧 Quick Fixes

### Port Already in Use
```bash
# Kill process on port 4000 (Windows)
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Or change port in .env
PORT=4001
```

### MongoDB Connection Error
```bash
# Check .env has correct MONGODB_URI
cat .env | findstr MONGODB_URI
```

### Invalid API Key Error
```bash
# Check you're using the correct API key
# Default: video-upload-server-secure-key-2026
# Should match API_KEY in .env
```

---

## 📁 File Locations

- **Server Code:** `E:\LMS\video-upload-server\`
- **Temp Downloads:** `E:\LMS\video-upload-server\uploads\`
- **Environment:** `E:\LMS\video-upload-server\.env`
- **Logs:** Console output (when running `npm run dev`)

---

## ✅ Success Indicators

When upload completes successfully, you'll see:
```
✅ UPLOAD COMPLETED SUCCESSFULLY
   Duration: 145.32s
   Activity ID: ...
   Bunny Video ID: ...
```

And in MongoDB:
```javascript
{
  "details": {
    "isUploaded": true,
    "uploadStatus": "completed",
    "videoId": "07aa1b97-8509-4cf2-8a72-fc43fa09034d",
    "uploadAttempts": 1
  }
}
```

---

**🎉 Ready to Test!**
