import { config } from "./config";
import { logger } from "./logger";

interface ApiResponse<T> { success: boolean; statusCode: number; message: string; data?: T; }

export interface PendingResult { hasWork: boolean; activityId?: string; title?: string; }

export interface VideoInfo {
    sessionId: string; assetId: string; localFilePath: string | null;
    bunnyVideoId: string | null; duration: number; size: number;
    downloadedAt: string | null; uploadedAt: string | null;
}

export interface ActivityResult {
    activityId: string; title: string; type: string;
    courseId: string | null; courseTitle: string | null; courseCollectionId: string | null;
    roomId: string | null; endTime: string; isRecordingAvailable: boolean;
    isDeleted: boolean; uploadStatus: string | null; uploadAttempts: number;
    videos: VideoInfo[];
}

export interface UploadConfigResult {
    bunnyVideoId: string; tusEndpoint: string; tusSignature: string;
    tusExpiry: number; libraryId: number;
}

export interface DownloadVideo {
    sessionId: string; assetId: string; downloadUrl: string;
    duration: number; size: number;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const options: RequestInit = {
        method,
        headers: { "x-api-key": config.apiKey, "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);

    logger.debug("API request", { method, url });

    const res = await fetch(url, options);

    if (!res.ok) {
        const text = await res.text();
        logger.error("API request failed", { method, url, status: res.status, response: text });
        throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
    }

    return res.json() as Promise<T>;
}

export async function fetchPending(): Promise<PendingResult> {
    const res = await request<ApiResponse<PendingResult>>("GET", `${config.lmsApiUrl}/v1/video-worker/pending`);
    return res.data!;
}

export async function fetchActivity(activityId: string): Promise<ActivityResult> {
    const res = await request<ApiResponse<ActivityResult>>("GET", `${config.lmsApiUrl}/v1/video-worker/activity/${activityId}`);
    return res.data!;
}

export async function updateStatus(activityId: string, body: Record<string, unknown>): Promise<void> {
    logger.info("Status update", { activityId, ...body });
    await request<ApiResponse<void>>("PATCH", `${config.lmsApiUrl}/v1/video-worker/status/${activityId}`, body);
}

export async function fetchUploadConfig(activityId: string, title: string, videoIndex: number): Promise<UploadConfigResult> {
    const res = await request<ApiResponse<UploadConfigResult>>("POST", `${config.lmsApiUrl}/v1/video-worker/upload-config/${activityId}`, { title, videoIndex });
    logger.info("Upload config received", { activityId, videoIndex, bunnyVideoId: res.data!.bunnyVideoId });
    return res.data!;
}

export async function fetchDownloadUrls(activityId: string): Promise<DownloadVideo[]> {
    const res = await request<{ success: boolean; videos: DownloadVideo[] }>("GET", `${config.lmsApiUrl}/v1/100ms/recordings/activity/${activityId}/videos`);
    logger.info("Download URLs fetched", { activityId, videoCount: res.videos.length });
    return res.videos;
}
