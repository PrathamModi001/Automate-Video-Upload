import fs from "fs";
import * as tus from "tus-js-client";
import type { UploadConfigResult } from "./api";
import { logger } from "./logger";

export function uploadVideo(filePath: string, tusConfig: UploadConfigResult): Promise<void> {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const fileSize = fs.statSync(filePath).size;
        const fileName = filePath.split(/[/\\]/).pop() || "video.mp4";
        const sizeMB = +(fileSize / 1024 / 1024).toFixed(2);

        logger.info("TUS upload starting", {
            fileName,
            sizeMB,
            bunnyVideoId: tusConfig.bunnyVideoId,
            chunks: Math.ceil(fileSize / (50 * 1024 * 1024)),
        });

        const upload = new tus.Upload(fileStream, {
            endpoint: tusConfig.tusEndpoint,
            retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
            chunkSize: 50 * 1024 * 1024,
            metadata: { filetype: "video/mp4", title: fileName },
            headers: {
                AuthorizationSignature: tusConfig.tusSignature,
                AuthorizationExpire: String(tusConfig.tusExpiry),
                VideoId: tusConfig.bunnyVideoId,
                LibraryId: String(tusConfig.libraryId),
            },
            uploadSize: fileSize,
            onError(err) {
                logger.error("TUS upload failed", { fileName, error: err.message });
                reject(err);
            },
            onProgress(bytesUploaded, bytesTotal) {
                const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
                const mb = (bytesUploaded / 1024 / 1024).toFixed(1);
                const totalMb = (bytesTotal / 1024 / 1024).toFixed(1);
                logger.progress(`  [upload] ${mb}MB / ${totalMb}MB (${pct}%)`);
            },
            onSuccess() {
                logger.progressEnd();
                logger.info("TUS upload complete", { fileName, sizeMB, bunnyVideoId: tusConfig.bunnyVideoId });
                resolve();
            },
        });

        upload.start();
    });
}
