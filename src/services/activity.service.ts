import { Activity } from "../models";

/**
 * Get all activities with pending uploads
 * Criteria:
 * - type: "live_session"
 * - details.isUploaded: false
 * - details.roomId: exists
 * - isDeleted: false
 */
export const getPendingUploadActivities = async () => {
    try {
        const activities = await Activity.find({
            type: "live_session",
            "details.isUploaded": false,
            "details.roomId": { $exists: true },
            isDeleted: false,
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
            "details.isUploaded": false,
            "details.roomId": { $exists: true },
            isDeleted: false,
        });

        return count;
    } catch (error: any) {
        console.error("❌ Error counting pending uploads:", error);
        return 0;
    }
};
