import crypto from "crypto";
import { TUSUploadConfig, TUSUploadSignature, VideoUploadMetadata } from "./types";
import { BUNNY_STREAM_CONFIG } from "./config";

/**
 * Generates a presigned signature for TUS upload
 * @param videoId - The video ID from Bunny Stream
 * @param expirationMinutes - Expiration time in minutes (default: 60)
 * @returns TUSUploadSignature
 */
export const generateTUSSignature = (
    videoId: string,
    expirationMinutes: number = 60
): TUSUploadSignature => {
    const expirationTime = Math.floor(Date.now() / 1000) + expirationMinutes * 60;

    // Generate signature: sha256(library_id + api_key + expiration_time + video_id)
    const signatureString = `${BUNNY_STREAM_CONFIG.LIBRARY_ID}${BUNNY_STREAM_CONFIG.API_KEY}${expirationTime}${videoId}`;
    const signature = crypto.createHash("sha256").update(signatureString).digest("hex");

    return {
        signature,
        expire: expirationTime,
        videoId,
        libraryId: Number(BUNNY_STREAM_CONFIG.LIBRARY_ID),
    };
};

/**
 * Generates TUS upload configuration for client-side upload
 * @param videoId - The video ID from Bunny Stream
 * @param metadata - Upload metadata
 * @param expirationMinutes - Signature expiration in minutes
 * @returns Object containing all necessary TUS upload configuration
 */
export const generateTUSUploadConfig = (
    videoId: string,
    metadata: VideoUploadMetadata,
    expirationMinutes: number = 60
): TUSUploadConfig => {
    const tusSignature = generateTUSSignature(videoId, expirationMinutes);

    return {
        endpoint: BUNNY_STREAM_CONFIG.TUS_ENDPOINT as string,
        headers: {
            AuthorizationSignature: tusSignature.signature,
            AuthorizationExpire: tusSignature.expire,
            VideoId: videoId,
            LibraryId: Number(BUNNY_STREAM_CONFIG.LIBRARY_ID),
        },
        metadata: {
            filetype: metadata.filetype,
            title: metadata.title,
            collection: metadata.collection || "",
            thumbnailTime: metadata.thumbnailTime || 0,
        },
        retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
    };
};
