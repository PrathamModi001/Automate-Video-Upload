import fs from "fs";
import { config } from "./config";
import { logger } from "./logger";
import { fetchPending, fetchActivity, updateStatus, fetchDownloadUrls, fetchUploadConfig } from "./api";
import { downloadVideo } from "./downloader";
import { uploadVideo } from "./uploader";

const processing = new Set<string>();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processActivity(activityId: string, title: string): Promise<void> {
    const startTime = Date.now();
    logger.info("Processing activity", { activityId, title });

    // 1. Fetch full activity details
    const activity = await fetchActivity(activityId);

    // Validate
    if (activity.isDeleted || activity.type !== "live_session" || !activity.roomId || !activity.isRecordingAvailable) {
        logger.warn("Activity validation failed, skipping", {
            activityId,
            isDeleted: activity.isDeleted,
            type: activity.type,
            roomId: activity.roomId,
            isRecordingAvailable: activity.isRecordingAvailable,
        });
        return;
    }

    // Check if all already uploaded
    const existingVideos = activity.videos || [];
    if (existingVideos.length > 0 && existingVideos.every(v => v.bunnyVideoId)) {
        logger.info("All videos already uploaded, marking completed", { activityId, videoCount: existingVideos.length });
        await updateStatus(activityId, { status: "completed" });
        return;
    }

    // 2. DOWNLOAD PHASE
    const needsDownload = existingVideos.length === 0 || existingVideos.some(v => {
        if (v.bunnyVideoId) return false;
        if (!v.localFilePath) return true;
        return !fs.existsSync(v.localFilePath);
    });
    let videosToUpload = existingVideos;

    if (needsDownload) {
        logger.info("Download phase started", { activityId });
        await updateStatus(activityId, { status: "downloading" });

        const downloadVideos = await fetchDownloadUrls(activityId);
        if (downloadVideos.length === 0) {
            logger.error("No videos found for download", { activityId });
            await updateStatus(activityId, { status: "failed", error: "No video recordings found in 100ms" });
            return;
        }

        logger.info("Videos to download", { activityId, count: downloadVideos.length });
        const downloadedVideos: any[] = [];

        for (const video of downloadVideos) {
            const existing = existingVideos.find(v => v.assetId === video.assetId && v.bunnyVideoId);
            if (existing) {
                logger.info("Skipping download, already uploaded", { activityId, assetId: video.assetId });
                downloadedVideos.push(existing);
                continue;
            }

            const existingWithPath = existingVideos.find(v => v.assetId === video.assetId && v.localFilePath);
            if (existingWithPath && fs.existsSync(existingWithPath.localFilePath!)) {
                logger.info("Skipping download, file exists on disk", { activityId, assetId: video.assetId });
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
                logger.error("Download failed", { activityId, assetId: video.assetId, error: err.message });
                await updateStatus(activityId, { status: "failed", error: `Download failed for asset ${video.assetId}: ${err.message}` });
                return;
            }
        }

        await updateStatus(activityId, { status: "downloaded", videos: downloadedVideos });
        videosToUpload = downloadedVideos;
    }

    // 3. UPLOAD PHASE
    logger.info("Upload phase started", { activityId, videoCount: videosToUpload.length });
    await updateStatus(activityId, { status: "uploading" });

    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < videosToUpload.length; i++) {
        const video = videosToUpload[i];

        if (video.bunnyVideoId) {
            logger.info("Skipping upload, already has bunnyVideoId", { activityId, videoIndex: i, bunnyVideoId: video.bunnyVideoId });
            uploadedCount++;
            continue;
        }

        if (!video.localFilePath || !fs.existsSync(video.localFilePath)) {
            logger.error("No local file for video, skipping", { activityId, videoIndex: i, localFilePath: video.localFilePath });
            failedCount++;
            continue;
        }

        try {
            const partTitle = `${activity.title} - Part ${i + 1}`;
            const uploadConfig = await fetchUploadConfig(activityId, partTitle, i);
            await uploadVideo(video.localFilePath, uploadConfig);
            await updateStatus(activityId, { status: "video-uploaded", videoIndex: i, bunnyVideoId: uploadConfig.bunnyVideoId });

            try {
                fs.unlinkSync(video.localFilePath);
                logger.info("Local file deleted", { activityId, videoIndex: i });
            } catch {}
            uploadedCount++;
        } catch (err: any) {
            logger.error("Upload failed for video", { activityId, videoIndex: i, error: err.message });
            failedCount++;
        }
    }

    // 4. Final status
    const durationMs = Date.now() - startTime;
    if (failedCount === 0) {
        await updateStatus(activityId, { status: "completed" });
        logger.info("Activity completed", { activityId, uploadedCount, durationMs });
    } else if (uploadedCount > 0) {
        await updateStatus(activityId, { status: "partial", error: `Failed to upload ${failedCount} video(s)` });
        logger.warn("Activity partially completed", { activityId, uploadedCount, failedCount, durationMs });
    } else {
        await updateStatus(activityId, { status: "failed", error: `All ${failedCount} video(s) failed to upload` });
        logger.error("Activity failed", { activityId, failedCount, durationMs });
    }
}

async function main(): Promise<void> {
    logger.info("Video Worker started", {
        lmsApiUrl: config.lmsApiUrl,
        pollInterval: config.pollInterval,
        tempDir: config.tempDir,
    });

    if (!config.apiKey) {
        logger.error("API_KEY not set in environment");
        process.exit(1);
    }
    if (!fs.existsSync(config.tempDir)) fs.mkdirSync(config.tempDir, { recursive: true });

    while (true) {
        try {
            const pending = await fetchPending();

            if (!pending.hasWork) {
                logger.debug("No pending work", { sleepMs: config.pollInterval });
                await sleep(config.pollInterval);
                continue;
            }

            const { activityId, title } = pending;

            if (processing.has(activityId!)) {
                logger.warn("Activity already in processing set, skipping", { activityId });
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
            logger.error("Main loop error", { error: err.message, stack: err.stack });
            await sleep(config.pollInterval);
        }
    }
}

main();
