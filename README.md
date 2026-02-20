# Video Upload Server

Independent Node.js server to automate uploading 100ms recordings to Bunny Stream.

## Overview

This server handles the automated process of:
1. Fetching activities with pending video uploads
2. Downloading recordings from 100ms
3. Creating video metadata in Bunny Stream
4. Uploading videos using TUS protocol
5. Updating activity status in the database

## Prerequisites

- Node.js v18 or higher
- MongoDB connection (shared with main LMS backend)
- 100ms Account with API credentials
- Bunny Stream Account with Library ID and API Key
- API Key for server authentication

## Installation

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env

# Edit .env with your credentials
```

## Configuration

Edit `.env` file with your configuration:

```env
# Server
PORT=4000
NODE_ENV=development

# MongoDB (use same database as main LMS)
MONGODB_URI=mongodb://localhost:27017/lms-database

# API Security
API_KEY=your-secure-api-key-here

# Bunny Stream
BUNNY_LIBRARY_ID=your-library-id
BUNNY_API_KEY=your-bunny-api-key
BUNNY_TUS_ENDPOINT=https://video.bunnycdn.com/tusupload
IS_BUNNY_ENABLED=true

# 100ms
HUNDREDMS_API_KEY=your-100ms-api-key
HUNDREDMS_WORKSPACE_ID=your-workspace-id
HUNDREDMS_RECORDING_API_URL=https://api.100ms.live/v2

# Upload Configuration
MAX_CONCURRENT_UPLOADS=3
RETRY_ATTEMPTS=3
DOWNLOAD_TIMEOUT=300000
UPLOAD_TIMEOUT=600000
TEMP_UPLOAD_DIR=./uploads
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start
```

## API Endpoints

### Get Pending Upload Activities
```bash
GET /api/activities/pending-uploads
Headers: x-api-key: your-api-key-here
```

### Upload Video by Activity ID
```bash
POST /api/upload/activity/:activityId
Headers: x-api-key: your-api-key-here
```

### Batch Process All Pending Uploads
```bash
POST /api/upload/process-all
Headers: x-api-key: your-api-key-here
```

### Health Check
```bash
GET /health
```

## Project Structure

```
video-upload-server/
├── src/
│   ├── config/          # Database, Bunny Stream, 100ms configuration
│   ├── middleware/      # API Key authentication
│   ├── models/          # Activity and Course models
│   ├── services/        # Business logic (activity, 100ms, bunny)
│   ├── controllers/     # Request handlers
│   ├── routes/          # API routes
│   ├── utils/           # Utilities (logger, file handler)
│   ├── jobs/            # Cron jobs (optional)
│   └── app.ts           # Main Express application
├── uploads/             # Temporary video storage
├── .env                 # Environment variables
└── package.json
```

## Features

- ✅ Automated video upload from 100ms to Bunny Stream
- ✅ TUS protocol for resumable uploads
- ✅ Retry logic with configurable attempts
- ✅ Upload status tracking in database
- ✅ Automatic file cleanup after upload
- ✅ API Key authentication
- ✅ Comprehensive error handling

## Database Schema

The server uses the Activity model from the main LMS backend with these additional fields:

- `isRecordingAvailable` - Whether 100ms recording is ready
- `recordingUrl` - 100ms recording URL
- `uploadStatus` - Current upload status (pending/downloading/uploading/completed/failed)
- `uploadError` - Error message if upload fails
- `uploadAttempts` - Number of retry attempts
- `lastUploadAttempt` - Last upload attempt timestamp

## License

ISC
