import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/responseHandler";
import { getPendingUploadActivities } from "../services/activity.service";

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
