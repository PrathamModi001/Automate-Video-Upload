import fs from "fs";
import { config } from "./config";
import { fetchPending, fetchActivity, updateStatus, fetchDownloadUrls, fetchUploadConfig } from "./api";
import { downloadVideo } from "./downloader";
import { uploadVideo } from "./uploader";

const processing = new Set<string>();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processActivity(activityId: string, title: string): Promise<void> {
    console.log(`\n========================================`);
    console.log(`Processing: ${title} (${activityId})`);
    console.log(`========================================`);

    // 1. Fetch full activity details
    const activity = await fetchActivity(activityId);

    // Validate
    if (activity.isDeleted || activity.type !== "live_session" || !activity.roomId || !activity.isRecordingAvailable) {
        console.log(`  Skipping: validation failed (deleted=${activity.isDeleted}, type=${activity.type}, roomId=${activity.roomId}, recording=${activity.isRecordingAvailable})`);
        return;
    }

    // Check if all already uploaded
    const existingVideos = activity.videos || [];
    if (existingVideos.length > 0 && existingVideos.every(v => v.bunnyVideoId)) {
        console.log(`  All videos already uploaded, marking completed`);
        await updateStatus(activityId, { status: "completed" });
        return;
    }

    // 2. DOWNLOAD PHASE
    const needsDownload = existingVideos.length === 0 || existingVideos.some(v => !v.bunnyVideoId && !v.localFilePath);
    let videosToUpload = existingVideos;

    if (needsDownload) {
        console.log(`  [phase] Downloading recordings from 100ms...`);
        await updateStatus(activityId, { status: "downloading" });

        const downloadVideos = await fetchDownloadUrls(activityId);
        if (downloadVideos.length === 0) {
            console.log(`  No videos found for download`);
            await updateStatus(activityId, { status: "failed", error: "No video recordings found in 100ms" });
            return;
        }

        console.log(`  Found ${downloadVideos.length} video(s) to download`);
        const downloadedVideos: any[] = [];

        for (const video of downloadVideos) {
            const existing = existingVideos.find(v => v.assetId === video.assetId && v.bunnyVideoId);
            if (existing) {
                console.log(`  Skipping download for asset ${video.assetId} (already uploaded)`);
                downloadedVideos.push(existing);
                continue;
            }

            const existingWithPath = existingVideos.find(v => v.assetId === video.assetId && v.localFilePath);
            if (existingWithPath && fs.existsSync(existingWithPath.localFilePath!)) {
                console.log(`  Skipping download for asset ${video.assetId} (file exists on disk)`);
                downloadedVideos.push(existingWithPath);
                continue;
            }

            try {
                const localPath = await downloadVideo(video.downloadUrl, activityId, video.sessionId, video.assetId);
                downloadedVideos.push({
                    sessionId: video.sessionId, assetId: video.assetId,
                    localFilePath: localPath, duration: video.duration, size: video.size,
                });
            } catch (err: any) {
                console.error(`  Failed to download asset ${video.assetId}: ${err.message}`);
                await updateStatus(activityId, { status: "failed", error: `Download failed for asset ${video.assetId}: ${err.message}` });
                return;
            }
        }

        await updateStatus(activityId, { status: "downloaded", videos: downloadedVideos });
        videosToUpload = downloadedVideos;
    }

    // 3. UPLOAD PHASE
    console.log(`  [phase] Uploading to Bunny Stream...`);
    await updateStatus(activityId, { status: "uploading" });

    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < videosToUpload.length; i++) {
        const video = videosToUpload[i];

        if (video.bunnyVideoId) {
            console.log(`  Skipping upload for video ${i} (already has bunnyVideoId)`);
            uploadedCount++;
            continue;
        }

        if (!video.localFilePath || !fs.existsSync(video.localFilePath)) {
            console.error(`  No local file for video ${i}, skipping`);
            failedCount++;
            continue;
        }

        try {
            const partTitle = `${activity.title} - Part ${i + 1}`;
            const uploadConfig = await fetchUploadConfig(activityId, partTitle, i);
            await uploadVideo(video.localFilePath, uploadConfig);
            await updateStatus(activityId, { status: "video-uploaded", videoIndex: i, bunnyVideoId: uploadConfig.bunnyVideoId });

            try { fs.unlinkSync(video.localFilePath); console.log(`  [cleanup] Deleted local file`); } catch {}
            uploadedCount++;
        } catch (err: any) {
            console.error(`  Failed to upload video ${i}: ${err.message}`);
            failedCount++;
        }
    }

    // 4. Final status
    if (failedCount === 0) {
        await updateStatus(activityId, { status: "completed" });
        console.log(`  All ${uploadedCount} video(s) uploaded successfully`);
    } else if (uploadedCount > 0) {
        await updateStatus(activityId, { status: "partial", error: `Failed to upload ${failedCount} video(s)` });
    } else {
        await updateStatus(activityId, { status: "failed", error: `All ${failedCount} video(s) failed to upload` });
    }
}

async function main(): Promise<void> {
    console.log("Video Worker started");
    console.log(`  LMS API: ${config.lmsApiUrl}`);
    console.log(`  Poll interval: ${config.pollInterval}ms`);
    console.log(`  Temp dir: ${config.tempDir}`);

    if (!config.apiKey) { console.error("ERROR: API_KEY not set"); process.exit(1); }
    if (!fs.existsSync(config.tempDir)) fs.mkdirSync(config.tempDir, { recursive: true });

    while (true) {
        try {
            const pending = await fetchPending();

            if (!pending.hasWork) {
                console.log(`[${new Date().toISOString()}] No pending work, sleeping ${config.pollInterval}ms`);
                await sleep(config.pollInterval);
                continue;
            }

            const { activityId, title } = pending;

            if (processing.has(activityId!)) {
                console.log(`  Skipping ${activityId} (already in processing set)`);
                await sleep(config.pollInterval);
                continue;
            }

            processing.add(activityId!);
            try {
                await processActivity(activityId!, title || "Untitled");
            } finally {
                processing.delete(activityId!);
            }
            // Immediately check for next job — no sleep
        } catch (err: any) {
            console.error(`[${new Date().toISOString()}] Loop error: ${err.message}`);
            await sleep(config.pollInterval);
        }
    }
}

main();
