import fs from "fs";
import path from "path";
import { config } from "./config";
import { logger } from "./logger";

export async function downloadVideo(
    downloadUrl: string, activityId: string, sessionId: string, assetId: string
): Promise<string> {
    if (!fs.existsSync(config.tempDir)) fs.mkdirSync(config.tempDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `${activityId}_${sessionId}_${assetId}_${timestamp}.mp4`;
    const filePath = path.join(config.tempDir, fileName);

    logger.info("Download starting", { activityId, sessionId, assetId, fileName });

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    if (!response.body) throw new Error("Download failed: No response body");

    const fileStream = fs.createWriteStream(filePath);
    const reader = (response.body as any).getReader();
    let downloaded = 0;
    const totalSize = parseInt(response.headers.get("content-length") || "0", 10);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloaded += value.length;
            if (totalSize > 0) {
                const pct = ((downloaded / totalSize) * 100).toFixed(1);
                const mb = (downloaded / 1024 / 1024).toFixed(1);
                const totalMb = (totalSize / 1024 / 1024).toFixed(1);
                logger.progress(`  [download] ${mb}MB / ${totalMb}MB (${pct}%)`);
            }
        }
    } finally {
        fileStream.end();
    }

    await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
    });

    logger.progressEnd();
    const sizeMB = +(downloaded / 1024 / 1024).toFixed(2);
    logger.info("Download complete", { activityId, sessionId, assetId, fileName, sizeMB });
    return filePath;
}
