import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import stream from "stream";

const pipeline = promisify(stream.pipeline);

const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || "http://localhost:3000";
const HEADERSAPIKEY = process.env.HEADERSAPIKEY || "";
// Use absolute path: E:\LMS\video-upload-server\uploads
const UPLOAD_DIR = process.env.TEMP_UPLOAD_DIR
    ? path.resolve(process.env.TEMP_UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
const DOWNLOAD_TIMEOUT = parseInt(process.env.DOWNLOAD_TIMEOUT || "600000"); // 10 min default

/**
 * Get all recording videos from main backend
 * Calls: GET /v1/100ms/recordings/activity/:activityId/videos
 * Returns full response with all videos
 */
export const getRecordingVideos = async (activityId: string): Promise<any> => {
    try {
        console.log(`📹 Fetching recording videos for activity: ${activityId}`);

        const response = await axios.get(
            `${MAIN_BACKEND_URL}/v1/100ms/recordings/activity/${activityId}/videos`,
            {
                headers: {
                    "x-api-key": HEADERSAPIKEY,
                },
                timeout: 30000, // 30 seconds for API call
            }
        );

        if (!response.data.success || !response.data.videos || response.data.videos.length === 0) {
            throw new Error("No recording videos found for this activity");
        }

        console.log(`✅ Got ${response.data.videos.length} video(s) for activity ${activityId}`);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 401) {
            throw new Error(
                "Authentication failed. Please provide valid HEADERSAPIKEY in .env"
            );
        }
        if (error.response?.status === 404) {
            throw new Error("Activity not found or no recording available yet");
        }
        console.error(`❌ Failed to get recording videos:`, error.message);
        throw new Error(`Failed to get recording videos: ${error.message}`);
    }
};

/**
 * Get recording URL for first video (backward compatibility)
 * Used by upload.controller.ts for single-video upload flow
 * Returns just the download URL string
 */
export const getRecordingUrl = async (activityId: string): Promise<string> => {
    const videosData = await getRecordingVideos(activityId);

    if (!videosData.videos || videosData.videos.length === 0) {
        throw new Error("No videos found for this activity");
    }

    // Return first video's download URL
    return videosData.videos[0].downloadUrl;
};

/**
 * Download video from presigned URL to NEW server's local storage
 * @param downloadUrl - Presigned URL from 100ms
 * @param fileName - Custom filename (should include activityId)
 */
export const downloadVideo = async (
    downloadUrl: string,
    fileName: string
): Promise<string> => {
    try {
        // Ensure upload directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            console.log(`📁 Created upload directory: ${UPLOAD_DIR}`);
        }

        const filePath = path.join(UPLOAD_DIR, fileName);

        console.log(`⬇️  Downloading video to: ${filePath}`);
        console.log(`   Timeout: ${DOWNLOAD_TIMEOUT}ms (${DOWNLOAD_TIMEOUT / 1000 / 60} minutes)`);

        // Download file with streaming
        const response = await axios({
            method: "GET",
            url: downloadUrl,
            responseType: "stream",
            timeout: DOWNLOAD_TIMEOUT,
        });

        const totalSize = response.headers["content-length"];
        let downloadedSize = 0;

        // Track download progress
        response.data.on("data", (chunk: Buffer) => {
            downloadedSize += chunk.length;
            if (totalSize) {
                const percentage = ((downloadedSize / parseInt(totalSize)) * 100).toFixed(2);
                process.stdout.write(`\r   Download progress: ${percentage}%`);
            }
        });

        // Save to local file
        await pipeline(response.data, fs.createWriteStream(filePath));

        const stats = fs.statSync(filePath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`\n✅ Video downloaded successfully: ${filePath}`);
        console.log(`   File size: ${fileSizeMB} MB`);

        return filePath;
    } catch (error: any) {
        console.error(`❌ Failed to download video:`, error.message);

        if (error.code === "ECONNABORTED") {
            throw new Error(`Download timeout after ${DOWNLOAD_TIMEOUT / 1000 / 60} minutes`);
        }

        throw new Error(`Failed to download video: ${error.message}`);
    }
};

/**
 * Delete local file after successful upload
 */
export const deleteLocalFile = (filePath: string): void => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted local file: ${filePath}`);
        }
    } catch (error: any) {
        console.error(`⚠️  Failed to delete local file ${filePath}:`, error.message);
    }
};

/**
 * Get file size in MB
 */
export const getFileSizeMB = (filePath: string): number => {
    try {
        const stats = fs.statSync(filePath);
        return stats.size / (1024 * 1024);
    } catch (error) {
        return 0;
    }
};
