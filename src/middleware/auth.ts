import { Request, Response, NextFunction } from "express";

/**
 * API Key authentication middleware
 * Matches main backend implementation exactly
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
    const apiKeyFromHeaders = req.headers["x-api-key"];
    const expectedApiKey = process.env.HEADERSAPIKEY;

    if (!apiKeyFromHeaders || apiKeyFromHeaders !== expectedApiKey) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid or missing API Key",
        });
    }

    next();
};
