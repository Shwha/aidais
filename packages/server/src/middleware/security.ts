import type { MiddlewareHandler } from "hono";
import {
  RATE_LIMIT_MESSAGES_PER_MIN,
  WS_MAX_MESSAGE_SIZE,
} from "@aidais/shared";

export function corsMiddleware(allowedOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("origin");

    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    await next();

    if (origin === allowedOrigin || allowedOrigin === origin) {
      c.header("Access-Control-Allow-Origin", allowedOrigin);
    }
  };
}

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "0");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' ws://localhost:* wss://localhost:*",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; ")
    );
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(
  maxRequests: number = RATE_LIMIT_MESSAGES_PER_MIN,
  windowMs: number = 60_000
): MiddlewareHandler {
  // Clean up stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 300_000).unref();

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count++;
      if (entry.count > maxRequests) {
        c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        return c.json({ error: "Too many requests" }, 429);
      }
    }

    await next();
  };
}

export { WS_MAX_MESSAGE_SIZE };
