import { Router } from "express";
import { getPendingActivities, downloadActivityVideo } from "../controllers/activity.controller";
import { apiKeyAuth } from "../middleware/auth";

const router = Router();

// Get all pending upload activities
router.get("/pending-uploads", apiKeyAuth, getPendingActivities);

// Download video and save path to DB
router.post("/:activityId/download", apiKeyAuth, downloadActivityVideo);

export default router;
