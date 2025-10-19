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

export const apiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 150,
  message: "Too many requests from this IP, please try again later.",
});

export const authLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 7,
  message:
    "Too many authentication attempts from this IP. Please try again later.",
});

export const emailLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 4,
  message: "Too many email requests from this IP. Please try again later.",
});

export const smsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many SMS requests from this IP. Please try again later.",
});

export const authenticatedActionLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: "You are performing this action too frequently. Please try again later.",
  keyGenerator: (req: Request): string => {
    if (req.user?.id) {
      return req.user.id.toString();
    }
    return ipKeyGenerator(req.ip!);
  },
});


export const dataCheckLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: "Too many data lookup requests from this IP. Please try again later.",
});
