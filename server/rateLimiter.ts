import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const standardHeaders = true;
const legacyHeaders = false;

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window (increased for normal usage)
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many requests, please try again later.' },
  handler: (req: Request, res: Response) => {
    res.status(429).json({ 
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(15 * 60 / 60) + ' minutes',
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per window
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many authentication attempts, please try again later.' },
  handler: (req: Request, res: Response) => {
    res.status(429).json({ 
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(15 * 60 / 60) + ' minutes',
    });
  },
  skipSuccessfulRequests: true,
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit to 5 requests per hour (for password reset, etc.)
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many requests for this operation, please try again later.' },
  handler: (req: Request, res: Response) => {
    res.status(429).json({ 
      error: 'Too many requests for this operation, please try again later.',
      retryAfter: '1 hour',
    });
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Allow 200 file uploads per 15 minutes for bulk operations
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many file uploads, please wait a few minutes and try again.' },
  handler: (req: Request, res: Response) => {
    res.status(429).json({ 
      error: 'Too many file uploads, please wait a few minutes and try again.',
      retryAfter: '15 minutes',
    });
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user?.id) {
      return user.id;
    }
    return 'anonymous';
  },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit AI requests to prevent abuse
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many AI requests, please slow down.' },
  handler: (req: Request, res: Response) => {
    res.status(429).json({ 
      error: 'Too many AI requests, please slow down.',
      retryAfter: '1 minute',
    });
  },
});

export const preferencesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // Allow 30 preference saves per minute (plenty for UI interactions)
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many preference saves, please slow down.' },
  handler: (req: Request, res: Response) => {
    res.status(429).json({ 
      error: 'Too many preference saves, please slow down.',
      retryAfter: '1 minute',
    });
  },
});
