// Don't import from backend - use same mongoose instance
import mongoose from "mongoose";
import { IActivity } from "../../../backend/src/services/activity/interfaces/activity.interface";

// Re-use existing model if already registered, otherwise create new one
// This prevents "Cannot overwrite model" errors
export const Activity =
    (mongoose.models.Activity as mongoose.Model<IActivity>) ||
    mongoose.model<IActivity>("Activity", new mongoose.Schema<IActivity>({
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        type: {
            type: String,
            enum: ["assignment", "quiz", "video", "material", "time_bound_quiz", "live_session"],
        },
        title: String,
        description: String,
        order: Number,
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        startTime: Date,
        endTime: Date,
        isDeleted: { type: Boolean, default: false },
    }, {
        timestamps: true,
        collection: "activities" // Explicitly set collection name
    }));
