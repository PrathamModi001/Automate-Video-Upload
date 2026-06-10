import { Activity } from "../models";

/**
 * Get all activities with pending uploads
 * Criteria:
 * - type: "live_session"
 * - details.isRecordingAvailable: true (recording exists in 100ms)
 * - details.isUploaded: false
 * - details.roomId: exists
 * - isDeleted: false
 * - endTime: in the past (session has ended)
 */
export const getPendingUploadActivities = async () => {
    try {
        const activities = await Activity.find({
            type: "live_session",
            "details.isRecordingAvailable": true, // Only activities with recordings
            "details.isUploaded": { $ne: true }, // Not uploaded (includes false and undefined)
            "details.roomId": { $exists: true },
            isDeleted: false,
            endTime: { $lt: new Date() }, // Only completed sessions (endTime in the past)
        })
            .populate("courseId", "title collection_id")
            .sort({ createdAt: 1 }) // Oldest first
            .lean();

        console.log(`📊 Found ${activities.length} pending upload activities`);
        return activities;
    } catch (error: any) {
        console.error("❌ Error fetching pending activities:", error);
        throw new Error(`Failed to fetch pending activities: ${error.message}`);
    }
};

/**
 * Get single activity by ID with course populated
 */
export const getActivityById = async (activityId: string) => {
    try {
        const activity = await Activity.findById(activityId)
            .populate("courseId", "title collection_id")
            .lean();

        if (!activity) {
            throw new Error(`Activity ${activityId} not found`);
        }

        return activity;
    } catch (error: any) {
        console.error(`❌ Error fetching activity ${activityId}:`, error);
        throw error;
    }
};

/**
 * Update activity upload status
 */
export const updateActivityUploadStatus = async (
    activityId: string,
    status: string,
    videoId?: string,
    error?: string
) => {
    try {
        const updateData: any = {
            "details.uploadStatus": status,
            "details.lastUploadAttempt": new Date(),
            $inc: { "details.uploadAttempts": 1 },
        };

        if (status === "completed" && videoId) {
            updateData["details.isUploaded"] = true;
            updateData["details.videoId"] = videoId;
            updateData["details.status"] = "finished";
        }

        if (error) {
            updateData["details.uploadError"] = error;
        }

        const activity = await Activity.findByIdAndUpdate(activityId, updateData, {
            new: true,
        });

        if (!activity) {
            throw new Error(`Activity ${activityId} not found`);
        }

        console.log(`✅ Updated activity ${activityId} status: ${status}`);
        return activity;
    } catch (error: any) {
        console.error(`❌ Error updating activity ${activityId}:`, error);
        throw error;
    }
};

/**
 * Count remaining pending uploads
 */
export const countPendingUploads = async (): Promise<number> => {
    try {
        const count = await Activity.countDocuments({
            type: "live_session",
            "details.isRecordingAvailable": true,
            "details.isUploaded": false,
            "details.roomId": { $exists: true },
            isDeleted: false,
            endTime: { $lt: new Date() }, // Only completed sessions
        });

        return count;
    } catch (error: any) {
        console.error("❌ Error counting pending uploads:", error);
        return 0;
    }
};

/**
 * Update activity with local file path and download status
 */
export const updateActivityWithLocalPath = async (
    activityId: string,
    status: string,
    localFilePath: string | null
) => {
    try {
        const updateData: any = {
            "details.uploadStatus": status,
            "details.lastUploadAttempt": new Date(),
            $inc: { "details.uploadAttempts": 1 },
        };

        if (status === "downloaded" && localFilePath) {
            updateData["details.localFilePath"] = localFilePath;
        }

        const activity = await Activity.findByIdAndUpdate(activityId, updateData, {
            new: true,
        });

        if (!activity) {
            throw new Error(`Activity ${activityId} not found`);
        }

        console.log(`✅ Updated activity ${activityId} status: ${status}`);
        return activity;
    } catch (error: any) {
        console.error(`❌ Error updating activity ${activityId}:`, error);
        throw error;
    }
};

/**
 * Update activity with multiple videos array and download status
 * Used when an activity has multiple sessions or multiple videos per session
 */
export const updateActivityWithVideos = async (
    activityId: string,
    status: string,
    videos: Array<{
        sessionId: string;
        assetId: string;
        localFilePath: string;
        duration: number;
        size: number;
        downloadedAt: Date;
    }>
) => {
    try {
        const updateData: any = {
            "details.uploadStatus": status,
            "details.lastUploadAttempt": new Date(),
            $inc: { "details.uploadAttempts": 1 },
        };

        if (status === "downloaded" && videos && videos.length > 0) {
            updateData["details.videos"] = videos;
        }

        const activity = await Activity.findByIdAndUpdate(activityId, updateData, {
            new: true,
        });

        if (!activity) {
            throw new Error(`Activity ${activityId} not found`);
        }

        console.log(`✅ Updated activity ${activityId} status: ${status} with ${videos.length} video(s)`);
        return activity;
    } catch (error: any) {
        console.error(`❌ Error updating activity ${activityId}:`, error);
        throw error;
    }
};
