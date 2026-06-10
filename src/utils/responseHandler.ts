import { Response } from "express";

export interface SendResponsePayload<T> {
    statusCode?: number;
    success?: boolean;
    message?: string;
    data?: T | T[] | null;
}

export default function sendResponse<T>(
    res: Response,
    { statusCode = 200, success = true, message = "Success", data }: SendResponsePayload<T>
) {
    return res.status(statusCode).json({
        success,
        statusCode,
        message,
        ...(data !== undefined && { data }),
    });
}
