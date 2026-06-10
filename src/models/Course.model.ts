// Define Course model locally to match backend schema
import mongoose from "mongoose";

// Simplified Course interface with only fields needed for video upload
interface ICourse {
    _id: mongoose.Types.ObjectId;
    title: string;
    collection_id?: string;
    description?: string;
    institution_id?: mongoose.Types.ObjectId;
    institution_name?: string;
    created_by?: mongoose.Types.ObjectId;
    course_status?: string;
    start_date?: Date;
    end_date?: Date;
    version?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const courseSchema = new mongoose.Schema<ICourse>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        institution_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Institution",
        },
        institution_name: {
            type: String,
            trim: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        course_status: {
            type: String,
            enum: ["draft", "published", "deleted", "archived"],
            default: "draft",
        },
        start_date: Date,
        end_date: Date,
        collection_id: {
            type: String,
            required: false,
        },
        version: {
            type: Number,
            default: 1,
        },
    },
    {
        timestamps: true,
        collection: "courses", // Explicitly set collection name
    }
);

// Re-use existing model if already registered
export const Course =
    (mongoose.models.Course as mongoose.Model<ICourse>) ||
    mongoose.model<ICourse>("Course", courseSchema);
