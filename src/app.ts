import dotenv from "dotenv";
import express from "express";
import { connectDatabase } from "./config/database";
import { globalErrorHandler } from "./middleware/errorHandler";
import activityRoutes from "./routes/activity.routes";
import uploadRoutes from "./routes/upload.routes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/activities", activityRoutes);
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Video Upload Server is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        name: "Video Upload Server",
        version: "1.0.0",
        description: "Automated 100ms to Bunny Stream video upload service",
        endpoints: {
            health: "GET /health",
            pendingUploads: "GET /api/activities/pending-uploads",
            uploadActivity: "POST /api/upload/activity/:activityId",
            processNext: "POST /api/upload/process-next",
        },
    });
});

// Global error handler (matches main backend)
app.use(globalErrorHandler);

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDatabase();

        // Start server
        app.listen(PORT, () => {
            console.log(`\n${"=".repeat(80)}`);
            console.log(`🚀 Video Upload Server started successfully`);
            console.log(`   Port: ${PORT}`);
            console.log(`   Environment: ${process.env.NODE_ENV}`);
            console.log(`   MongoDB: Connected`);
            console.log(`   Bunny Stream: ${process.env.IS_BUNNY_ENABLED === "true" ? "Enabled" : "Disabled"}`);
            console.log(`\n📡 API Endpoints:`);
            console.log(`   Health Check:     http://localhost:${PORT}/health`);
            console.log(`   Pending Uploads:  http://localhost:${PORT}/api/activities/pending-uploads`);
            console.log(`   Upload Activity:  http://localhost:${PORT}/api/upload/activity/:activityId`);
            console.log(`   Process Next:     http://localhost:${PORT}/api/upload/process-next`);
            console.log(`${"=".repeat(80)}\n`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down gracefully...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down gracefully...");
    process.exit(0);
});

// Start the server
startServer();

export default app;
