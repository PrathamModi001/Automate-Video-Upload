import { Request, Response, NextFunction } from "express";

// This utility function wraps an async route handler to catch any errors and pass them to the next middleware
export default function catchAsync(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);
}
