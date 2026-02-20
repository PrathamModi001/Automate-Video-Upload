export default class ApiError extends Error {
    statusCode: number;
    data?: any;

    constructor(statusCode: number, message: string, data?: any) {
        super(message);
        this.statusCode = statusCode;
        this.data = data;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const notFound = (message = "Resource not found", data?: any) => {
    return new ApiError(404, message, data);
};

export const unauthorized = (message = "Unauthorized", data?: any) => {
    return new ApiError(401, message, data);
};

export const badRequest = (message = "Bad request", data?: any) => {
    return new ApiError(400, message, data);
};

export const internalServerError = (message = "Internal server error", data?: any) => {
    return new ApiError(500, message, data);
};
