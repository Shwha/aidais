import type { MiddlewareHandler } from "hono";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    console.log(
      formatLog({ timestamp: new Date().toISOString(), level: "info", message, ...data })
    );
  },
  warn(message: string, data?: Record<string, unknown>) {
    console.warn(
      formatLog({ timestamp: new Date().toISOString(), level: "warn", message, ...data })
    );
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(
      formatLog({ timestamp: new Date().toISOString(), level: "error", message, ...data })
    );
  },
  debug(message: string, data?: Record<string, unknown>) {
    if (process.env["NODE_ENV"] === "development") {
      console.debug(
        formatLog({ timestamp: new Date().toISOString(), level: "debug", message, ...data })
      );
    }
  },
};

export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    logger.info("request", { method, path, status, duration_ms: duration });
  };
}
