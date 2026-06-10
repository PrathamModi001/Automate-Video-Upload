import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/responseHandler";
import { badRequest } from "../utils/apiError";
import { getActivityById } from "../services/activity.service";
import { downloadActivityVideo } from "./activity.controller";
import { uploadVideoByActivityId } from "./upload.controller";

/**
 * Webhook endpoint for when recording is ready
 * POST /api/webhooks/recording-ready
 * Called by main backend when live session ends and recording is available
 */
export const recordingReadyWebhook = catchAsync(async (req: Request, res: Response) => {
    const { activityId } = req.body;

    if (!activityId) {
        throw badRequest("activityId is required");
    }

    const activity = await getActivityById(activityId);

    if (!activity.details?.isRecordingAvailable) {
        return sendResponse(res, {
            message: "Recording not available yet",
            data: { activityId, processed: false },
        });
    }

    sendResponse(res, {
        message: "Recording processing started",
        data: {
            activityId,
            activityTitle: activity.title,
            processing: true,
        },
    });

    setImmediate(async () => {
        try {
            const needsDownload = !activity.details?.videos || activity.details.videos.length === 0;

            if (needsDownload) {
                const downloadReq = { params: { activityId } } as any;
                let downloadResult: any = null;
                const downloadRes = {
                    status: (code: number) => ({
                        json: (data: any) => {
                            downloadResult = { statusCode: code, ...data };
                        },
                    }),
                } as Response;

                const mockNext = (err?: any) => {
                    if (err) {
                        throw err;
                    }
                };

                await downloadActivityVideo(downloadReq, downloadRes, mockNext as any);

                if (!downloadResult?.success) {
                    throw new Error("Failed to download videos");
                }
            }

            const uploadReq = { params: { activityId } } as any;
            let uploadResult: any = null;
            const uploadRes = {
                status: (code: number) => ({
                    json: (data: any) => {
                        uploadResult = { statusCode: code, ...data };
                    },
                }),
            } as Response;

            const mockNext = (err?: any) => {
                if (err) {
                    throw err;
                }
            };

            await uploadVideoByActivityId(uploadReq, uploadRes, mockNext as any);
        } catch (error: any) {
            console.error(`❌ Webhook processing failed for activity ${activityId}:`, error.message);
        }
    });
});
