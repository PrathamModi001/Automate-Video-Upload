import { BUNNY_STREAM_CONFIG } from "./config";

// Common headers for API requests
export const getApiHeaders = (contentType: string = "application/json") => ({
    accept: "application/json",
    AccessKey: BUNNY_STREAM_CONFIG.API_KEY,
    "Content-Type": contentType,
});
