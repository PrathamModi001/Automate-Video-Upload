import mongoose from "mongoose";

export const connectDatabase = async (): Promise<void> => {
    try {
        const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/lms-c3i";

        // Match backend connection options exactly
        const conn = await mongoose.connect(mongoUri, {
            maxPoolSize: 200,
            minPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`   Database: ${conn.connection.name}`);
    } catch (error: any) {
        console.error("❌ MongoDB connection error:", error.message);
        // Don't exit - allow server to continue (matches backend behavior)
    }
};

// Handle connection events
mongoose.connection.on("connected", () => {
    console.log("📡 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
    console.log("📴 Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("🛑 MongoDB connection closed through app termination");
    process.exit(0);
});
