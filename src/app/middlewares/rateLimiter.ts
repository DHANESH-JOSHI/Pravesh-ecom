import rateLimit, {
  Options,
  RateLimitRequestHandler,
  ipKeyGenerator,
} from "express-rate-limit";
import { ApiError } from "@/interface";
import status from "http-status";
import { Request } from "express";

type RateLimiterOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: Options["keyGenerator"];
};

const createRateLimiter = (options: RateLimiterOptions): RateLimitRequestHandler => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new ApiError(status.TOO_MANY_REQUESTS, options.message, "RATE_LIMIT"));
    },
  });
};

// General API rate limiter: 100 requests per minute (industry standard)
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

// Authentication rate limiter: 5 attempts per 15 minutes (prevents brute force)
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message:
    "Too many authentication attempts from this IP. Please try again later.",
});

// Email rate limiter: 10 emails per hour (industry standard)
export const emailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many email requests from this IP. Please try again later.",
});

// SMS rate limiter: 5 SMS per hour (SMS is expensive, industry standard)
export const smsLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many SMS requests from this IP. Please try again later.",
});

// Authenticated action limiter: 200 requests per minute per user (industry standard)
export const authenticatedActionLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: "You are performing this action too frequently. Please try again later.",
  keyGenerator: (req: Request): string => {
    if (req.user?.id) {
      return req.user.id.toString();
    }
    return ipKeyGenerator(req.ip!);
  },
});

// Token/session limiter: 30 requests per minute (for logout, refresh-tokens)
export const tokenLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: "Too many token/session requests from this IP. Please try again later.",
});

// Data check limiter: 100 requests per minute (industry standard)
export const dataCheckLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: "Too many data lookup requests from this IP. Please try again later.",
});
