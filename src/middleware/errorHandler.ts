import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/apiError";

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // Handle MongoDB CastError (invalid ObjectId)
    if (err.name === "CastError" && err.kind === "ObjectId") {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: `Invalid ID format: "${err.value}" is not a valid identifier`,
            field: err.path,
        });
    }

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            statusCode: err.statusCode,
            message: err.message,
        });
    }

    // Unexpected errors
    console.error("Unexpected error:", err);

    res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Internal Server Error",
    });
};
