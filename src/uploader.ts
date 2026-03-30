import fs from "fs";
import * as tus from "tus-js-client";
import type { UploadConfigResult } from "./api";

export function uploadVideo(filePath: string, tusConfig: UploadConfigResult): Promise<void> {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const fileSize = fs.statSync(filePath).size;
        const fileName = filePath.split(/[/\\]/).pop() || "video.mp4";

        console.log(`  [upload] Starting TUS upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

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
                console.error(`\n  [upload] Failed: ${err.message}`);
                reject(err);
            },
            onProgress(bytesUploaded, bytesTotal) {
                const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
                const mb = (bytesUploaded / 1024 / 1024).toFixed(1);
                const totalMb = (bytesTotal / 1024 / 1024).toFixed(1);
                process.stdout.write(`\r  [upload] ${mb}MB / ${totalMb}MB (${pct}%)`);
            },
            onSuccess() {
                console.log(`\n  [upload] Complete: ${fileName}`);
                resolve();
            },
        });

        upload.start();
    });
}
