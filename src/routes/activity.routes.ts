import { Router } from "express";
import { getPendingActivities } from "../controllers/activity.controller";
import { apiKeyAuth } from "../middleware/auth";

const router = Router();

// Get all pending upload activities
router.get("/pending-uploads", apiKeyAuth, getPendingActivities);

export default router;
