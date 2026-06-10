import axios from "axios";

const HEADERSAPIKEY = process.env.HEADERSAPIKEY || "";
const PROCESS_INTERVAL = parseInt(process.env.PROCESS_INTERVAL || "60000"); // 1 minute default for dev

/**
 * Auto-processor service
 * Automatically checks for pending uploads and processes them
 */
export const startAutoProcessor = () => {
    const intervalMinutes = (PROCESS_INTERVAL / 1000 / 60).toFixed(1);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`🤖 AUTO-PROCESSOR STARTED`);
    console.log(`${"=".repeat(80)}`);
    console.log(`   Check interval: ${intervalMinutes} minute(s)`);
    console.log(`   Endpoint: POST /api/upload/process-next`);
    console.log(`   Mode: Development (will upgrade to webhooks later)`);
    console.log(`${"=".repeat(80)}\n`);

    // Run immediately on startup
    console.log(`🔍 Running initial check...`);
    processNext();

    // Then run on interval
    setInterval(() => {
        console.log(`\n🔍 [AUTO-PROCESSOR] Checking for pending uploads...`);
        processNext();
    }, PROCESS_INTERVAL);
};

/**
 * Process next pending upload
 */
const processNext = async () => {
    try {
        const response = await axios.post(
            "http://localhost:4000/api/upload/process-next",
            {},
            {
                headers: {
                    "x-api-key": HEADERSAPIKEY,
                },
                timeout: 600000, // 10 minutes timeout for long uploads
            }
        );

        if (response.data.success) {
            const data = response.data.data;
            if (data.remainingUploads !== undefined && data.remainingUploads === 0) {
                console.log(`   ℹ️  No pending uploads`);
            } else {
                console.log(`   ✅ Processed: ${data.activityTitle}`);
                console.log(`   📊 Remaining: ${data.remainingUploads || 0}`);
            }
        }
    } catch (error: any) {
        if (error.response?.status === 400 && error.response?.data?.message?.includes("No pending uploads")) {
            console.log(`   ℹ️  No pending uploads`);
        } else if (error.code === "ECONNREFUSED") {
            console.error(`   ❌ Cannot connect to video-upload-server`);
        } else {
            console.error(`   ❌ Auto-processor error: ${error.message}`);
        }
    }
};
