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
 * Upload video for a specific activity
 * POST /api/upload/activity/:activityId
 */
export const uploadVideoByActivityId = catchAsync(async (req: Request, res: Response) => {
    const activityId = Array.isArray(req.params.activityId)
        ? req.params.activityId[0]
        : req.params.activityId;
    let localFilePath: string | null = null;
    const startTime = Date.now();

    try {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`🎬 STARTING UPLOAD FOR ACTIVITY: ${activityId}`);
        console.log(`${"=".repeat(80)}\n`);

        // Step 1: Get activity details
        console.log(`📋 Step 1: Fetching activity details...`);
        const activity: any = await getActivityById(activityId);

        // Validation checks
        if (activity.isDeleted) throw badRequest("Activity is deleted");
        if (activity.type !== "live_session") throw badRequest("Activity is not a live session");
        if (!activity.details?.roomId) throw badRequest("Activity has no 100ms room ID");
        if (activity.details?.isUploaded) {
            throw badRequest("Video already uploaded to Bunny Stream", {
                bunnyVideoId: activity.details.videoId,
            });
        }

        const courseData: any = activity.courseId;
        if (!courseData?.collection_id) throw badRequest("Course has no Bunny Stream collection ID");

        console.log(`   ✅ Activity: ${activity.title}`);
        console.log(`   ✅ Course: ${courseData.title}`);
        console.log(`   ✅ Collection ID: ${courseData.collection_id}`);

        // Step 2: Update status to downloading
        console.log(`\n📥 Step 2: Updating status to 'downloading'...`);
        await updateActivityUploadStatus(activityId, "downloading");

        // Step 3: Get recording URL from main backend
        console.log(`\n🔗 Step 3: Getting recording URL from 100ms...`);
        const recordingUrl = await getRecordingUrl(activityId);
        console.log(`   ✅ Recording URL obtained (expires in 12 hours)`);

        // Step 4: Download video to NEW server's local storage
        console.log(`\n⬇️  Step 4: Downloading video to NEW server...`);
        const fileName = `${activityId}_${Date.now()}.mp4`;
        localFilePath = await downloadVideo(recordingUrl, fileName);
        const fileSizeMB = getFileSizeMB(localFilePath);
        console.log(`   ✅ Video downloaded: ${fileSizeMB.toFixed(2)} MB`);

        // Step 5: Update status to uploading
        console.log(`\n📤 Step 5: Updating status to 'uploading'...`);
        await updateActivityUploadStatus(activityId, "uploading");

        // Step 6: Upload to Bunny Stream (creates video + uploads with TUS)
        console.log(`\n☁️  Step 6: Uploading to Bunny Stream...`);
        const bunnyVideoId = await uploadToBunnyStream(activity.title, localFilePath, courseData.collection_id);

        // Step 7: Update activity with video ID and mark as uploaded
        console.log(`\n💾 Step 7: Updating activity with Bunny Video ID...`);
        await updateActivityUploadStatus(activityId, "completed", bunnyVideoId);

        // Step 8: Clean up local file
        console.log(`\n🗑️  Step 8: Cleaning up local file...`);
        deleteLocalFile(localFilePath);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n${"=".repeat(80)}`);
        console.log(`✅ UPLOAD COMPLETED SUCCESSFULLY`);
        console.log(`   Duration: ${durationSeconds}s`);
        console.log(`   Activity ID: ${activityId}`);
        console.log(`   Bunny Video ID: ${bunnyVideoId}`);
        console.log(`${"=".repeat(80)}\n`);

        sendResponse(res, {
            message: "Video uploaded successfully",
            data: {
                activityId,
                activityTitle: activity.title,
                bunnyVideoId,
                uploadStatus: "completed",
                fileSizeMB: fileSizeMB.toFixed(2),
                durationSeconds: parseFloat(durationSeconds),
                fileDeleted: true,
            },
        });
    } catch (error: any) {
        console.error(`\n❌ UPLOAD FAILED FOR ACTIVITY ${activityId}:`, error.message);

        // Update activity with error
        try {
            await updateActivityUploadStatus(activityId, "failed", undefined, error.message);
        } catch (updateError) {
            console.error("Failed to update activity with error status:", updateError);
        }

        // Clean up local file if exists
        if (localFilePath) deleteLocalFile(localFilePath);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n${"=".repeat(80)}`);
        console.log(`❌ UPLOAD FAILED`);
        console.log(`   Duration: ${durationSeconds}s`);
        console.log(`   Error: ${error.message}`);
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
