import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  getConfiguredApiKey,
  getMaxUploadBytes,
  hasValidAuth,
  isOriginAllowed,
  parsePositiveInt,
  sanitizeDownloadFilename,
} from "./securityCore";
import type { Env } from "./securityCore";

export {
  getAllowedOrigins,
  getConfiguredApiKey,
  getMaxUploadBytes,
  hasValidAuth,
  isOriginAllowed,
  sanitizeDownloadFilename,
  shouldRequireAuth,
} from "./securityCore";

export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  next();
};

export const corsGuardMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.get("Origin");

  if (!isOriginAllowed(origin)) {
    res.status(403).send("CORS origin is not allowed");
    return;
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.setHeader("Access-Control-Max-Age", "600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
};

export const requireMergeAuth = (req: Request, res: Response, next: NextFunction) => {
  if (hasValidAuth(req.headers)) {
    next();
    return;
  }

  const status = getConfiguredApiKey() ? 401 : 503;
  res.status(status).send(status === 401 ? "Unauthorized" : "Excel API auth is not configured");
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

export const createRateLimitMiddleware = (env: Env = process.env) => {
  const windowMs = parsePositiveInt(env.EXCEL_TOOLS_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const max = parsePositiveInt(env.EXCEL_TOOLS_RATE_LIMIT_MAX, 20);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const bucket = rateBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).send("Too many requests");
      return;
    }

    next();
  };
};

export const requireContentLengthLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = Number(req.get("Content-Length") || 0);
  if (contentLength > getMaxUploadBytes()) {
    res.status(413).send("Soubor je příliš velký");
    return;
  }
  next();
};

export const handleUploadError = (error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).send("Soubor je příliš velký");
    return;
  }

  if (error) {
    res.status(400).send("Neplatný upload");
    return;
  }

  next();
};
