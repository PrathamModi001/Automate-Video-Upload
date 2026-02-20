import * as tus from "tus-js-client";
import fs from "fs";
import { createVideo } from "../integrations/bunnyStream/createVideo";
import { generateTUSUploadConfig } from "../integrations/bunnyStream/tusUpload";
import { TUSUploadConfig } from "../integrations/bunnyStream/types";

/**
 * Upload video to Bunny Stream using TUS protocol
 * Steps:
 * 1. Create video metadata in Bunny Stream
 * 2. Generate TUS upload config
 * 3. Upload video using TUS protocol
 */
export const uploadToBunnyStream = async (
    activityTitle: string,
    filePath: string,
    collectionId: string
): Promise<string> => {
    try {
        // Step 1: Create video metadata in Bunny Stream
        console.log(`📤 Creating video in Bunny Stream: ${activityTitle}`);
        const bunnyVideoData = await createVideo(activityTitle, collectionId);
        const videoId = bunnyVideoData.guid;

        console.log(`   Bunny Video ID: ${videoId}`);

        // Step 2: Generate TUS upload config
        console.log(`🔐 Generating TUS upload config`);
        const tusConfig = generateTUSUploadConfig(
            videoId,
            {
                title: activityTitle,
                filetype: "video/mp4",
                collection: collectionId,
            },
            60 // 60 minutes expiration
        );

        // Step 3: Upload video using TUS protocol
        console.log(`🚀 Starting TUS upload...`);
        await uploadVideoWithTUS(filePath, tusConfig);

        console.log(`✅ Video uploaded to Bunny Stream successfully!`);
        return videoId;
    } catch (error: any) {
        console.error(`❌ Upload to Bunny Stream failed:`, error.message);
        throw new Error(`Upload to Bunny Stream failed: ${error.message}`);
    }
};

/**
 * Upload video using TUS protocol with resumable upload
 */
const uploadVideoWithTUS = async (filePath: string, tusConfig: TUSUploadConfig): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const file = fs.createReadStream(filePath);
            const fileSize = fs.statSync(filePath).size;

            console.log(`   File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
            console.log(`   Chunk size: 50 MB`);

            const upload = new tus.Upload(file, {
                endpoint: tusConfig.endpoint,
                retryDelays: tusConfig.retryDelays,
                headers: tusConfig.headers as any,
                metadata: tusConfig.metadata as any,
                chunkSize: 50 * 1024 * 1024, // 50MB chunks
                uploadSize: fileSize,
                onError: (error) => {
                    console.error(`\n❌ TUS Upload failed:`, error);
                    reject(error);
                },
                onProgress: (bytesUploaded, bytesTotal) => {
                    const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                    process.stdout.write(
                        `\r   Upload progress: ${percentage}% (${(bytesUploaded / (1024 * 1024)).toFixed(2)}/${(bytesTotal / (1024 * 1024)).toFixed(2)} MB)`
                    );
                },
                onSuccess: () => {
                    console.log(`\n✅ TUS Upload completed successfully`);
                    resolve();
                },
            });

            // Start the upload
            upload.start();
        } catch (error: any) {
            console.error(`❌ TUS Upload initialization failed:`, error);
            reject(error);
        }
    });
};
