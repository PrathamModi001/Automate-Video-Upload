import { Router } from "express";
import { uploadVideoByActivityId, processNextPendingUpload } from "../controllers/upload.controller";
import { apiKeyAuth } from "../middleware/auth";

const router = Router();

// Upload video for specific activity
router.post("/activity/:activityId", apiKeyAuth, uploadVideoByActivityId);

// Process next pending upload (one at a time)
router.post("/process-next", apiKeyAuth, processNextPendingUpload);

export default router;
