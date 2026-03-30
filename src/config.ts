import path from "path";

export const config = {
  lmsApiUrl: process.env.LMS_API_URL || "http://localhost:3000",
  apiKey: process.env.API_KEY || "",
  pollInterval: parseInt(process.env.POLL_INTERVAL || "60000", 10),
  tempDir: path.resolve(process.env.TEMP_DIR || "./uploads"),
};
