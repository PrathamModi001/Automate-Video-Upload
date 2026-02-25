import { Router } from "express";
import { recordingReadyWebhook } from "../controllers/webhook.controller";
import { apiKeyAuth } from "../middleware/auth";

const router = Router();

// Webhook endpoint for when recording is ready
router.post("/recording-ready", apiKeyAuth, recordingReadyWebhook);

export default router;
