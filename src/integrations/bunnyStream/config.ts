export const BUNNY_STREAM_CONFIG = {
    LIBRARY_ID: process.env.BUNNY_LIBRARY_ID,
    API_KEY: process.env.BUNNY_API_KEY,
    TUS_ENDPOINT: process.env.BUNNY_TUS_ENDPOINT,
    API_BASE_URL: process.env.BUNNY_STREAM_API_BASE_URL,
    IS_ENABLED: process.env.IS_BUNNY_ENABLED === "true",
};

export const BUNNY_STREAM_ENDPOINTS = {
    VIDEOS: `${BUNNY_STREAM_CONFIG.API_BASE_URL}/videos`,
    VIDEO_DETAILS: (videoId: string) =>
        `${BUNNY_STREAM_CONFIG.API_BASE_URL}/videos/${videoId}`,
};
