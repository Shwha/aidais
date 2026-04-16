import type { MiddlewareHandler } from "hono";

type LogLevel = "info" | "warn" | "error" | "debug" | "verbose";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function getLogLevel(): LogLevel {
  const env = process.env["LOG_LEVEL"]?.toLowerCase();
  if (env && env in LEVEL_PRIORITY) return env as LogLevel;
  return process.env["NODE_ENV"] === "development" ? "debug" : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getLogLevel()];
}

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
  verbose(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("verbose")) return;
    console.log(
      formatLog({ timestamp: new Date().toISOString(), level: "verbose", message, ...data })
    );
  },
  debug(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("debug")) return;
    console.debug(
      formatLog({ timestamp: new Date().toISOString(), level: "debug", message, ...data })
    );
  },
  info(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("info")) return;
    console.log(
      formatLog({ timestamp: new Date().toISOString(), level: "info", message, ...data })
    );
  },
  warn(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("warn")) return;
    console.warn(
      formatLog({ timestamp: new Date().toISOString(), level: "warn", message, ...data })
    );
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(
      formatLog({ timestamp: new Date().toISOString(), level: "error", message, ...data })
    );
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
