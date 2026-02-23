import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/responseHandler";
import { badRequest } from "../utils/apiError";
import {
    getActivityById,
    updateActivityUploadStatus,
    getPendingUploadActivities,
} from "../services/activity.service";
import { getRecordingUrl, downloadVideo, deleteLocalFile, getFileSizeMB } from "../services/recording.service";
import { uploadToBunnyStream } from "../services/upload.service";

/**
 * Upload all videos for a specific activity to Bunny Stream
 * POST /api/upload/activity/:activityId
 * Expects videos to be already downloaded (details.videos array populated)
 */
export const uploadVideoByActivityId = catchAsync(async (req: Request, res: Response) => {
    const activityId = Array.isArray(req.params.activityId)
        ? req.params.activityId[0]
        : req.params.activityId;
    const startTime = Date.now();
    const uploadedVideos: any[] = [];
    const failedVideos: any[] = [];

    console.log(`\n${"=".repeat(80)}`);
    console.log(`☁️  UPLOADING VIDEOS TO BUNNY STREAM: ${activityId}`);
    console.log(`${"=".repeat(80)}\n`);

    try {
        // Step 1: Get activity details
        console.log(`📋 Step 1: Fetching activity details...`);
        const activity: any = await getActivityById(activityId);

        // Validation checks
        if (activity.isDeleted) throw badRequest("Activity is deleted");
        if (activity.type !== "live_session") throw badRequest("Activity is not a live session");
        if (!activity.details?.roomId) throw badRequest("Activity has no 100ms room ID");

        if (!activity.details?.videos || activity.details.videos.length === 0) {
            throw badRequest("No videos downloaded yet. Please download videos first.");
        }

        // Check if already uploaded
        const allUploaded = activity.details.videos.every((v: any) => v.bunnyVideoId);
        if (allUploaded && activity.details?.isUploaded) {
            console.log(`ℹ️  All videos already uploaded to Bunny Stream`);
            return sendResponse(res, {
                message: "All videos already uploaded to Bunny Stream",
                data: {
                    activityId,
                    activityTitle: activity.title,
                    videoCount: activity.details.videos.length,
                    videos: activity.details.videos,
                    alreadyUploaded: true,
                },
            });
        }

        const courseData: any = activity.courseId;
        if (!courseData?.collection_id) throw badRequest("Course has no Bunny Stream collection ID");

        console.log(`   ✅ Activity: ${activity.title}`);
        console.log(`   ✅ Videos to upload: ${activity.details.videos.length}`);

        // Step 3: Upload each video to Bunny Stream
        console.log(`\n${"=".repeat(80)}`);
        console.log(`☁️  Step 3: Uploading ${activity.details.videos.length} video(s) to Bunny Stream`);
        console.log(`${"=".repeat(80)}\n`);

        console.log(`📝 Updating activity status to 'uploading'...`);
        await updateActivityUploadStatus(activityId, "uploading");
        console.log(`   ✅ Status updated\n`);

        const path = require("path");
        const fs = require("fs");

        for (let i = 0; i < activity.details.videos.length; i++) {
            const video = activity.details.videos[i];
            console.log(`${"─".repeat(80)}`);
            console.log(`📹 Video ${i + 1}/${activity.details.videos.length}`);
            console.log(`${"─".repeat(80)}`);
            console.log(`   Session ID: ${video.sessionId}`);
            console.log(`   Asset ID: ${video.assetId}`);
            console.log(`   Local Path: ${video.localFilePath}`);
            console.log(`   Downloaded At: ${video.downloadedAt}`);
            console.log(`   Bunny Video ID: ${video.bunnyVideoId || "NOT UPLOADED YET"}`);

            // Check if already uploaded
            if (video.bunnyVideoId) {
                console.log(`   ℹ️  Already uploaded - skipping`);
                uploadedVideos.push(video);
                continue;
            }

            try {
                console.log(`\n   🔍 Checking local file...`);
                // Resolve absolute path
                const localFilePath = path.isAbsolute(video.localFilePath)
                    ? video.localFilePath
                    : path.join(process.cwd(), video.localFilePath);

                console.log(`      Original path: ${video.localFilePath}`);
                console.log(`      Resolved path: ${localFilePath}`);
                console.log(`      Is absolute: ${path.isAbsolute(video.localFilePath)}`);

                // Check if file exists
                console.log(`      Checking if file exists...`);
                const fileExists = fs.existsSync(localFilePath);
                console.log(`      File exists: ${fileExists}`);

                if (!fileExists) {
                    throw new Error(`Video file not found: ${localFilePath}`);
                }

                const fileSizeMB = getFileSizeMB(localFilePath);
                console.log(`      File size: ${fileSizeMB.toFixed(2)} MB`);
                console.log(`      ✅ File verified\n`);

                // Upload to Bunny Stream
                const videoTitle = `${activity.title} - Part ${i + 1}`;
                console.log(`   ☁️  Uploading to Bunny Stream...`);
                console.log(`      Title: ${videoTitle}`);
                console.log(`      Collection ID: ${courseData.collection_id}`);
                console.log(`      File path: ${localFilePath}`);

                const bunnyVideoId = await uploadToBunnyStream(
                    videoTitle,
                    localFilePath,
                    courseData.collection_id
                );

                console.log(`      ✅ Upload successful!`);
                console.log(`      Bunny Video ID: ${bunnyVideoId}\n`);

                // Update video record
                console.log(`   💾 Updating video record...`);
                video.bunnyVideoId = bunnyVideoId;
                video.uploadedAt = new Date();
                uploadedVideos.push(video);
                console.log(`      ✅ Video record updated\n`);

                // Delete local file after successful upload
                console.log(`   🗑️  Deleting local file...`);
                deleteLocalFile(localFilePath);
                console.log(`      ✅ Local file deleted\n`);

                console.log(`   ✅ Video ${i + 1} completed successfully\n`);
            } catch (videoError: any) {
                console.error(`\n   ❌ VIDEO ${i + 1} UPLOAD FAILED`);
                console.error(`   Error: ${videoError.message}`);
                console.error(`   Stack: ${videoError.stack}\n`);
                failedVideos.push({
                    ...video,
                    error: videoError.message,
                });
            }
        }

        // Step 4: Update activity in database
        console.log(`${"=".repeat(80)}`);
        console.log(`💾 Step 4: Updating activity in database`);
        console.log(`${"=".repeat(80)}\n`);

        const Activity = require("../models").Activity;

        const updateData: any = {
            "details.videos": uploadedVideos,
            "details.uploadStatus": failedVideos.length > 0 ? "partial" : "completed",
            "details.lastUploadAttempt": new Date(),
            $inc: { "details.uploadAttempts": 1 },
        };

        if (failedVideos.length === 0) {
            updateData["details.isUploaded"] = true;
        }

        if (failedVideos.length > 0) {
            updateData["details.uploadError"] = `Failed to upload ${failedVideos.length} video(s)`;
        }

        console.log(`📝 Update data:`);
        console.log(`   Uploaded videos count: ${uploadedVideos.length}`);
        console.log(`   Failed videos count: ${failedVideos.length}`);
        console.log(`   Upload status: ${updateData["details.uploadStatus"]}`);
        console.log(`   Is uploaded: ${updateData["details.isUploaded"] || false}`);
        console.log(`   Last upload attempt: ${updateData["details.lastUploadAttempt"]}`);

        console.log(`\n🔄 Executing database update...`);
        console.log(`   Query: Activity.findByIdAndUpdate("${activityId}", ...)`);

        await Activity.findByIdAndUpdate(activityId, updateData);

        console.log(`   ✅ Database updated successfully\n`);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`${"=".repeat(80)}`);
        if (failedVideos.length === 0) {
            console.log(`✅ ALL UPLOADS COMPLETED SUCCESSFULLY`);
        } else {
            console.log(`⚠️  UPLOAD PARTIALLY COMPLETED`);
        }
        console.log(`${"=".repeat(80)}`);
        console.log(`📊 Final Statistics:`);
        console.log(`   Total videos: ${activity.details.videos.length}`);
        console.log(`   Successfully uploaded: ${uploadedVideos.length}`);
        console.log(`   Failed: ${failedVideos.length}`);
        console.log(`   Duration: ${durationSeconds}s`);
        console.log(`   Status: ${failedVideos.length === 0 ? "COMPLETED" : "PARTIAL"}`);

        if (uploadedVideos.length > 0) {
            console.log(`\n✅ Uploaded Videos:`);
            uploadedVideos.forEach((v, idx) => {
                console.log(`   ${idx + 1}. Session: ${v.sessionId}`);
                console.log(`      Bunny ID: ${v.bunnyVideoId}`);
                console.log(`      Uploaded: ${v.uploadedAt}`);
            });
        }

        if (failedVideos.length > 0) {
            console.log(`\n❌ Failed Videos:`);
            failedVideos.forEach((v, idx) => {
                console.log(`   ${idx + 1}. Session: ${v.sessionId}`);
                console.log(`      Error: ${v.error}`);
            });
        }

        console.log(`${"=".repeat(80)}\n`);

        sendResponse(res, {
            message: failedVideos.length === 0
                ? "All videos uploaded successfully"
                : `${uploadedVideos.length} videos uploaded, ${failedVideos.length} failed`,
            data: {
                activityId,
                activityTitle: activity.title,
                totalVideos: activity.details.videos.length,
                uploadedCount: uploadedVideos.length,
                failedCount: failedVideos.length,
                uploadedVideos,
                failedVideos,
                durationSeconds: parseFloat(durationSeconds),
                status: failedVideos.length === 0 ? "completed" : "partial",
            },
        });
    } catch (error: any) {
        console.error(`\n${"=".repeat(80)}`);
        console.error(`❌ CRITICAL ERROR - UPLOAD FAILED`);
        console.error(`${"=".repeat(80)}`);
        console.error(`📝 Error Details:`);
        console.error(`   Activity ID: ${activityId}`);
        console.error(`   Error Message: ${error.message}`);
        console.error(`   Error Name: ${error.name}`);
        console.error(`   Error Code: ${error.code || "N/A"}`);
        console.error(`\n📚 Stack Trace:`);
        console.error(error.stack);
        console.error(`\n📊 Upload Progress Before Error:`);
        console.error(`   Uploaded: ${uploadedVideos.length}`);
        console.error(`   Failed: ${failedVideos.length}`);
        console.error(`${"=".repeat(80)}\n`);

        // Update activity with error
        console.log(`💾 Attempting to update activity with error status...`);
        try {
            await updateActivityUploadStatus(activityId, "failed", undefined, error.message);
            console.log(`   ✅ Activity status updated to 'failed'`);
        } catch (updateError: any) {
            console.error(`   ❌ Failed to update activity error status:`, updateError.message);
        }

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n${"=".repeat(80)}`);
        console.log(`❌ UPLOAD PROCESS TERMINATED`);
        console.log(`${"=".repeat(80)}`);
        console.log(`   Duration: ${durationSeconds}s`);
        console.log(`   Final Status: FAILED`);
        console.log(`${"=".repeat(80)}\n`);

        throw error;
    }
});

/**
 * Process next pending upload (one at a time)
 * POST /api/upload/process-next
 */
export const processNextPendingUpload = catchAsync(async (req: Request, res: Response) => {
    console.log(`\n🔍 Finding next pending upload...`);

    // Find the oldest pending upload
    const activities = await getPendingUploadActivities();

    if (activities.length === 0) {
        return sendResponse(res, {
            message: "No pending uploads",
            data: { remainingUploads: 0 },
        });
    }

    const activity = activities[0];
    const remainingAfter = activities.length - 1;

    console.log(`   Found activity: ${activity.title} (${activity._id})`);
    console.log(`   Remaining after this: ${remainingAfter}`);

    // Process this activity (reuse the upload function)
    const activityId = activity._id.toString();

    // Create mock request object
    const mockReq = { params: { activityId } } as any;

    // Create custom response handler
    let uploadResult: any = null;
    const mockRes = {
        status: (code: number) => ({
            json: (data: any) => {
                uploadResult = { statusCode: code, ...data };
            },
        }),
    } as Response;

    // Call the upload function (catchAsync expects 3 params: req, res, next)
    const mockNext = (err?: any) => {
        if (err) throw err;
    };
    await uploadVideoByActivityId(mockReq, mockRes, mockNext as any);

    // Return the result
    if (uploadResult?.success) {
        return sendResponse(res, {
            message: "Upload completed",
            data: {
                ...uploadResult.data,
                remainingUploads: remainingAfter,
            },
        });
    } else {
        return res.status(uploadResult?.statusCode || 500).json(uploadResult);
    }
});
