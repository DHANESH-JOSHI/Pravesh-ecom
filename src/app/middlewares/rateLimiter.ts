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

/**
 * A factory function to create a rate limiter middleware.
 * This centralizes the configuration and ensures consistency.
 * @param options - The specific options for this rate limiter instance.
 * @returns A rate-limit middleware.
 */
const createRateLimiter = (options: RateLimiterOptions): RateLimitRequestHandler => {
  return rateLimit({
    ...options,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next) => {
      next(new ApiError(status.TOO_MANY_REQUESTS, options.message, "RATE_LIMIT"));
    },
  });
};

/**
 * A general-purpose rate limiter for most API routes.
 * This provides a baseline protection against abuse.
 */
export const apiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // few minutes
  max: 60, // Limit each IP to 60 requests per `window` (here, per few minutes)
  message: "Too many requests from this IP, please try again later.",
});

/**
 * A stricter rate limiter for authentication routes (login, register).
 * This helps prevent brute-force attacks on user credentials.
 */
export const authLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 7, // Limit each IP to 7 authentication attempts per 10 minutes
  message:
    "Too many authentication attempts from this IP. Please try again later.",
});

/**
 * A very strict rate limiter for actions that trigger sending an email.
 * This helps prevent spamming users and exhausting email quotas.
 */
export const emailLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 4, // Limit each IP to 4 email requests per 30 minutes
  message: "Too many email requests from this IP. Please try again later.",
});

/**
 * A very strict rate limiter for actions that trigger sending an SMS.
 * This helps prevent SMS bombing and expensive API usage.
 */
export const smsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 SMS requests per 15 minutes
  message: "Too many SMS requests from this IP. Please try again later.",
});

/**
 * A rate limiter for authenticated users performing sensitive actions.
 * It keys on the user's ID if they are logged in, falling back to IP.
 * NOTE: This middleware must be placed *after* your authentication middleware.
 */
export const authenticatedActionLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // few minutes
  max: 20, // Limit each user to 20 actions per 5 minutes
  message: "You are performing this action too frequently. Please try again later.",
  keyGenerator: (req: Request): string => {
    return req.user?.id?.toString() || ipKeyGenerator(req.ip!);
  },
});

/**
 * A stricter rate limiter for public-facing data lookup endpoints.
 * This helps prevent data enumeration attacks (e.g., checking if emails/phones exist).
 */
export const dataCheckLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit each IP to 25 lookup requests per 15 minutes
  message: "Too many data lookup requests from this IP. Please try again later.",
});
