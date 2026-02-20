import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import stream from "stream";

const pipeline = promisify(stream.pipeline);

const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || "http://localhost:3000";
const HEADERSAPIKEY = process.env.HEADERSAPIKEY || "";
const UPLOAD_DIR = process.env.TEMP_UPLOAD_DIR || "./uploads";
const DOWNLOAD_TIMEOUT = parseInt(process.env.DOWNLOAD_TIMEOUT || "600000"); // 10 min default

/**
 * Get recording download URL from main backend
 * Calls: GET /v1/100ms/recordings/activity/:activityId/videos
 */
export const getRecordingUrl = async (activityId: string): Promise<string> => {
    try {
        console.log(`📹 Fetching recording URL for activity: ${activityId}`);

        const response = await axios.get(
            `${MAIN_BACKEND_URL}/v1/100ms/recordings/activity/${activityId}/videos`,
            {
                headers: {
                    headersapikey: HEADERSAPIKEY,
                },
                timeout: 30000, // 30 seconds for API call
            }
        );

        if (!response.data.success || !response.data.videos || response.data.videos.length === 0) {
            throw new Error("No recording videos found for this activity");
        }

        const downloadUrl = response.data.videos[0]?.downloadUrl;

        if (!downloadUrl) {
            throw new Error("Download URL not available in response");
        }

        console.log(`✅ Got recording URL for activity ${activityId}`);
        return downloadUrl;
    } catch (error: any) {
        if (error.response?.status === 401) {
            throw new Error(
                "Authentication failed. Please provide valid HEADERSAPIKEY in .env"
            );
        }
        if (error.response?.status === 404) {
            throw new Error("Activity not found or no recording available yet");
        }
        console.error(`❌ Failed to get recording URL:`, error.message);
        throw new Error(`Failed to get recording URL: ${error.message}`);
    }
};

/**
 * Download video from presigned URL to NEW server's local storage
 */
export const downloadVideo = async (
    downloadUrl: string,
    activityId: string
): Promise<string> => {
    try {
        // Ensure upload directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            console.log(`📁 Created upload directory: ${UPLOAD_DIR}`);
        }

        const fileName = `${activityId}_${Date.now()}.mp4`;
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
