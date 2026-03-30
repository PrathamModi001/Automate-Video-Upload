import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const config = {
    lmsApiUrl: (process.env.LMS_API_URL || "http://localhost:3000").replace(/\/$/, ""),
    apiKey: process.env.API_KEY || "",
    pollInterval: parseInt(process.env.POLL_INTERVAL || "60000", 10),
    tempDir: path.resolve(process.env.TEMP_DIR || "./uploads"),
};
