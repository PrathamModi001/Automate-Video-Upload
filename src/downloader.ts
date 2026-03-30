import fs from "fs";
import path from "path";
import { config } from "./config";

export async function downloadVideo(
    downloadUrl: string, activityId: string, sessionId: string, assetId: string
): Promise<string> {
    // Ensure temp dir exists
    if (!fs.existsSync(config.tempDir)) fs.mkdirSync(config.tempDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `${activityId}_${sessionId}_${assetId}_${timestamp}.mp4`;
    const filePath = path.join(config.tempDir, fileName);

    console.log(`  [download] Starting: ${fileName}`);

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
                process.stdout.write(`\r  [download] ${mb}MB / ${totalMb}MB (${pct}%)`);
            }
        }
    } finally {
        fileStream.end();
    }

    await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
    });

    console.log(`\n  [download] Complete: ${fileName} (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
    return filePath;
}
