import rateLimit from 'express-rate-limit';

/**
 * Simple rate limiter middleware for the API.  The configuration values
 * are pulled from environment variables so they can be adjusted in
 * production without changing source code.
 *
 * By default the window is 15 minutes (900 000 ms) and the max number of
 * requests per window is 100.  The client receives a generic message if
 * they exceed the limit.
 *
 * This module exports a ready–made limiter instance that can be passed to
 * `app.use()` or to individual routes if finer control is required.
 */
export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: 'Too many requests from this IP, please try again later.'
});
