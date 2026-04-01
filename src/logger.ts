type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    [key: string]: unknown;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...data,
    };
    const line = JSON.stringify(entry);

    if (level === "error") {
        process.stderr.write(line + "\n");
    } else {
        process.stdout.write(line + "\n");
    }
}

export const logger = {
    info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
    debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),

    /** Progress line — overwrites current line (non-JSON, for human readability during transfers) */
    progress: (message: string) => {
        process.stdout.write(`\r${message}`);
    },
    /** End a progress line */
    progressEnd: () => {
        process.stdout.write("\n");
    },
};
