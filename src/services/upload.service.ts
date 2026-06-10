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
    console.log(`\n   ┌${"─".repeat(76)}┐`);
    console.log(`   │ 📤 BUNNY STREAM UPLOAD PROCESS${" ".repeat(44)}│`);
    console.log(`   └${"─".repeat(76)}┘`);

    try {
        // Step 1: Create video metadata in Bunny Stream
        console.log(`\n   📝 Step 1/3: Creating video metadata in Bunny Stream...`);
        console.log(`      Title: ${activityTitle}`);
        console.log(`      Collection ID: ${collectionId}`);
        console.log(`      File path: ${filePath}`);

        const bunnyVideoData = await createVideo(activityTitle, collectionId);
        const videoId = bunnyVideoData.guid;

        console.log(`      ✅ Video created successfully`);
        console.log(`      Bunny Video ID: ${videoId}`);
        console.log(`      Library ID: ${bunnyVideoData.videoLibraryId || "N/A"}`);

        // Step 2: Generate TUS upload config
        console.log(`\n   🔐 Step 2/3: Generating TUS upload configuration...`);
        const tusConfig = generateTUSUploadConfig(
            videoId,
            {
                title: activityTitle,
                filetype: "video/mp4",
                collection: collectionId,
            },
            60 // 60 minutes expiration
        );

        console.log(`      ✅ TUS config generated`);
        console.log(`      Endpoint: ${tusConfig.endpoint}`);
        console.log(`      Video ID: ${tusConfig.headers.VideoId}`);
        console.log(`      Library ID: ${tusConfig.headers.LibraryId}`);
        console.log(`      Signature expires: ${new Date(tusConfig.headers.AuthorizationExpire * 1000).toISOString()}`);
        console.log(`      Chunk size: 50 MB`);
        console.log(`      Retry delays: ${tusConfig.retryDelays.length} attempts configured`);

        // Step 3: Upload video using TUS protocol
        console.log(`\n   🚀 Step 3/3: Starting TUS upload...`);
        await uploadVideoWithTUS(filePath, tusConfig);

        console.log(`\n   ✅ Bunny Stream upload completed successfully!`);
        console.log(`   Video ID: ${videoId}\n`);
        return videoId;
    } catch (error: any) {
        console.error(`\n   ❌ Bunny Stream upload failed!`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}\n`);
        throw new Error(`Upload to Bunny Stream failed: ${error.message}`);
    }
};

/**
 * Upload video using TUS protocol with resumable upload
 */
const uploadVideoWithTUS = async (filePath: string, tusConfig: TUSUploadConfig): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            console.log(`      📂 Reading file...`);
            const file = fs.createReadStream(filePath);
            const fileSize = fs.statSync(filePath).size;

            console.log(`      File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
            console.log(`      Chunk size: 50 MB`);
            console.log(`      Estimated chunks: ${Math.ceil(fileSize / (50 * 1024 * 1024))}`);

            console.log(`\n      🔧 Initializing TUS upload client...`);
            const upload = new tus.Upload(file, {
                endpoint: tusConfig.endpoint,
                retryDelays: tusConfig.retryDelays,
                headers: tusConfig.headers as any,
                metadata: tusConfig.metadata as any,
                chunkSize: 50 * 1024 * 1024, // 50MB chunks
                uploadSize: fileSize,
                onError: (error) => {
                    console.error(`\n\n      ❌ TUS Upload Error:`);
                    console.error(`         Message: ${error.message}`);
                    console.error(`         Stack: ${error.stack}`);
                    reject(error);
                },
                onProgress: (bytesUploaded, bytesTotal) => {
                    const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                    const uploadedMB = (bytesUploaded / (1024 * 1024)).toFixed(2);
                    const totalMB = (bytesTotal / (1024 * 1024)).toFixed(2);
                    const currentChunk = Math.ceil(bytesUploaded / (50 * 1024 * 1024));
                    const totalChunks = Math.ceil(bytesTotal / (50 * 1024 * 1024));

                    process.stdout.write(
                        `\r      📊 Progress: ${percentage}% | ${uploadedMB}/${totalMB} MB | Chunk ${currentChunk}/${totalChunks}`
                    );
                },
                onSuccess: () => {
                    console.log(`\n      ✅ TUS Upload completed successfully`);
                    resolve();
                },
            });

            console.log(`      ✅ TUS client initialized`);
            console.log(`      🚀 Starting upload...\n`);

            // Start the upload
            upload.start();
        } catch (error: any) {
            console.error(`\n      ❌ TUS Upload initialization failed:`);
            console.error(`         Error: ${error.message}`);
            console.error(`         Stack: ${error.stack}`);
            reject(error);
        }
    });
};
