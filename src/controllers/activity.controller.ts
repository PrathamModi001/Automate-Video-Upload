import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/responseHandler";
import { badRequest } from "../utils/apiError";
import {
    getPendingUploadActivities,
    getActivityById,
    updateActivityWithLocalPath,
    updateActivityWithVideos,
} from "../services/activity.service";
import { getRecordingVideos, downloadVideo, getFileSizeMB } from "../services/recording.service";

/**
 * Get all activities with pending uploads
 * GET /api/activities/pending-uploads
 */
export const getPendingActivities = catchAsync(async (req: Request, res: Response) => {
    const activities = await getPendingUploadActivities();

    sendResponse(res, {
        message: "Pending upload activities fetched successfully",
        data: {
            count: activities.length,
            activities,
        },
    });
});

/**
 * Download all videos for an activity and save paths to DB
 * Handles multiple sessions and multiple videos per session
 * POST /api/activities/:activityId/download
 */
export const downloadActivityVideo = catchAsync(async (req: Request, res: Response) => {
    const activityId = Array.isArray(req.params.activityId)
        ? req.params.activityId[0]
        : req.params.activityId;
    const startTime = Date.now();

    console.log(`\n${"=".repeat(80)}`);
    console.log(`⬇️  DOWNLOADING VIDEOS FOR ACTIVITY: ${activityId}`);
    console.log(`${"=".repeat(80)}\n`);

    // Get activity
    const activity: any = await getActivityById(activityId);

    // Validations
    if (activity.isDeleted) throw badRequest("Activity is deleted");
    if (activity.type !== "live_session") throw badRequest("Activity is not a live session");
    if (!activity.details?.roomId) throw badRequest("Activity has no 100ms room ID");
    if (!activity.endTime || new Date(activity.endTime) > new Date()) {
        throw badRequest("Live session has not ended yet");
    }
    if (!activity.details?.isRecordingAvailable) {
        throw badRequest("No recording available for this activity");
    }

    // Check if already downloaded AND files exist on disk
    if (activity.details?.videos && activity.details.videos.length > 0) {
        console.log(`ℹ️  Checking if downloaded videos exist on disk...`);

        // Check if all video files actually exist
        const fs = require("fs");
        const path = require("path");
        const allFilesExist = activity.details.videos.every((v: any) => {
            const fullPath = path.isAbsolute(v.localFilePath)
                ? v.localFilePath
                : path.join(process.cwd(), v.localFilePath);
            return fs.existsSync(fullPath);
        });

        if (allFilesExist) {
            console.log(`✅ All ${activity.details.videos.length} video file(s) exist on disk`);
            const totalSizeMB = activity.details.videos.reduce((sum: number, v: any) => {
                return sum + (v.size ? v.size / (1024 * 1024) : 0);
            }, 0);

            return sendResponse(res, {
                message: "Videos already downloaded",
                data: {
                    activityId,
                    activityTitle: activity.title,
                    videoCount: activity.details.videos.length,
                    videos: activity.details.videos,
                    totalSizeMB: totalSizeMB.toFixed(2),
                    alreadyDownloaded: true,
                },
            });
        } else {
            console.log(`⚠️  Some video files are missing from disk, re-downloading...`);
        }
    }

    console.log(`   Activity: ${activity.title}`);

    // Step 1: Update status to downloading
    console.log(`\n📥 Step 1: Updating status to 'downloading'...`);
    await updateActivityWithLocalPath(activityId, "downloading", null);

    // Step 2: Get ALL recording videos from backend
    console.log(`\n🔗 Step 2: Getting recording videos from 100ms...`);
    const videosData = await getRecordingVideos(activityId);
    console.log(`   ✅ Found ${videosData.videos?.length || 0} video(s)`);

    if (!videosData.videos || videosData.videos.length === 0) {
        throw badRequest("No video recordings found for this activity");
    }

    // Step 3: Download ALL videos
    console.log(`\n⬇️  Step 3: Downloading ${videosData.videos.length} video(s)...`);
    const downloadedVideos = [];

    for (let i = 0; i < videosData.videos.length; i++) {
        const video = videosData.videos[i];
        console.log(`\n   📹 Video ${i + 1}/${videosData.videos.length}:`);
        console.log(`      Session ID: ${video.sessionId}`);
        console.log(`      Asset ID: ${video.assetId}`);

        // Download with unique filename: activityId_sessionId_assetId_timestamp.mp4
        const fileName = `${activityId}_${video.sessionId}_${video.assetId}_${Date.now()}.mp4`;
        const localFilePath = await downloadVideo(video.downloadUrl, fileName);
        const fileSizeMB = getFileSizeMB(localFilePath);

        console.log(`      ✅ Downloaded: ${fileSizeMB.toFixed(2)} MB`);

        downloadedVideos.push({
            sessionId: video.sessionId,
            assetId: video.assetId,
            localFilePath,
            duration: video.duration || 0,
            size: video.size || 0,
            downloadedAt: new Date(),
        });
    }

    // Step 4: Save all video paths to database
    console.log(`\n💾 Step 4: Saving ${downloadedVideos.length} video path(s) to database...`);
    await updateActivityWithVideos(activityId, "downloaded", downloadedVideos);

    const totalSizeMB = downloadedVideos.reduce((sum, v) => sum + getFileSizeMB(v.localFilePath), 0);
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ DOWNLOAD COMPLETED`);
    console.log(`   Duration: ${durationSeconds}s`);
    console.log(`   Videos Downloaded: ${downloadedVideos.length}`);
    console.log(`   Total Size: ${totalSizeMB.toFixed(2)} MB`);
    console.log(`${"=".repeat(80)}\n`);

    sendResponse(res, {
        message: "All videos downloaded and paths saved to DB",
        data: {
            activityId,
            activityTitle: activity.title,
            videoCount: downloadedVideos.length,
            videos: downloadedVideos,
            totalSizeMB: totalSizeMB.toFixed(2),
            durationSeconds: parseFloat(durationSeconds),
        },
    });
});
