// HTTP client wrapper — all communication with LMS-BE goes through here
// Endpoints: GET /pending, GET /activity/:id, PATCH /status/:id, POST /upload-config/:id

import { config } from "./config";

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

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: { "x-api-key": config.apiKey, "Content-Type": "application/json", ...(options.headers as Record<string,string>) },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
    }
    return res.json() as Promise<T>;
}

export async function fetchPending(): Promise<PendingResult> {
    const res = await request<ApiResponse<PendingResult>>(`${config.lmsApiUrl}/v1/video-worker/pending`);
    return res.data!;
}

export async function fetchActivity(activityId: string): Promise<ActivityResult> {
    const res = await request<ApiResponse<ActivityResult>>(`${config.lmsApiUrl}/v1/video-worker/activity/${activityId}`);
    return res.data!;
}

export async function updateStatus(activityId: string, body: Record<string, unknown>): Promise<void> {
    await request<ApiResponse<void>>(`${config.lmsApiUrl}/v1/video-worker/status/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

export async function fetchUploadConfig(activityId: string, title: string, videoIndex: number): Promise<UploadConfigResult> {
    const res = await request<ApiResponse<UploadConfigResult>>(`${config.lmsApiUrl}/v1/video-worker/upload-config/${activityId}`, {
        method: "POST",
        body: JSON.stringify({ title, videoIndex }),
    });
    return res.data!;
}

export async function fetchDownloadUrls(activityId: string): Promise<DownloadVideo[]> {
    const res = await request<{ success: boolean; videos: DownloadVideo[] }>(`${config.lmsApiUrl}/v1/100ms/recordings/activity/${activityId}/videos`);
    return res.videos;
}
