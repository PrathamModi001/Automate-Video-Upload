import axios from "axios";
import { getApiHeaders } from "./utils";
import { BUNNY_STREAM_ENDPOINTS } from "./config";
import { BunnyVideoCreateResponse } from "./types";

/**
 * Creates a new video object in Bunny Stream
 * @param title - The title of the video
 * @param collectionId - Optional collection ID
 * @returns Promise<BunnyVideoCreateResponse>
 */
export const createVideo = async (
    title: string,
    collectionId?: string
): Promise<BunnyVideoCreateResponse> => {
    try {
        const payload: any = {
            title: title,
        };

        if (collectionId) payload.collectionId = collectionId;

        const response = await axios.post(BUNNY_STREAM_ENDPOINTS.VIDEOS, payload, {
            headers: getApiHeaders(),
        });

        console.log(`✅ Created video in Bunny Stream: ${response.data.guid}`);
        return response.data;
    } catch (error: any) {
        console.error("❌ Failed to create video in Bunny Stream:", error.response?.data);
        throw new Error(
            `Failed to create video in Bunny Stream: ${error.response?.data?.message || error.message}`
        );
    }
};
