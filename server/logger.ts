import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

const LOG_COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
};

function formatLog(entry: LogEntry): string {
  const color = LOG_COLORS[entry.level] || LOG_COLORS.reset;
  const timestamp = entry.timestamp;
  const level = entry.level.toUpperCase().padEnd(5);
  const requestId = entry.requestId ? `[${entry.requestId.slice(0, 8)}]` : '';
  
  let line = `${timestamp} ${color}${level}${LOG_COLORS.reset} ${requestId} ${entry.message}`;
  
  if (entry.method && entry.path) {
    line += ` | ${entry.method} ${entry.path}`;
  }
  
  if (entry.statusCode) {
    const statusColor = entry.statusCode >= 400 ? LOG_COLORS.error : LOG_COLORS.info;
    line += ` ${statusColor}${entry.statusCode}${LOG_COLORS.reset}`;
  }
  
  if (entry.duration !== undefined) {
    line += ` (${entry.duration}ms)`;
  }
  
  if (entry.userId) {
    line += ` user:${entry.userId.slice(0, 8)}`;
  }
  
  return line;
}

class Logger {
  private static instance: Logger;
  private requestMetrics: Map<string, { startTime: number; path: string; method: string }> = new Map();

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata,
    };

    console.log(formatLog(entry));

    if (level === 'error' && entry.error?.stack) {
      console.error(entry.error.stack);
    }
  }

  debug(message: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, metadata);
    }
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>) {
    this.log('error', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  startRequest(requestId: string, path: string, method: string) {
    this.requestMetrics.set(requestId, {
      startTime: Date.now(),
      path,
      method,
    });
  }

  endRequest(requestId: string, statusCode: number, userId?: string) {
    const metrics = this.requestMetrics.get(requestId);
    if (metrics) {
      const duration = Date.now() - metrics.startTime;
      this.info('Request completed', {
        requestId,
        method: metrics.method,
        path: metrics.path,
        statusCode,
        duration,
        userId,
      });
      this.requestMetrics.delete(requestId);
    }
  }

  getMetrics() {
    return {
      activeRequests: this.requestMetrics.size,
    };
  }
}

export const logger = Logger.getInstance();

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.requestId || randomUUID();
  const startTime = Date.now();

  if (req.path.startsWith('/api')) {
    logger.startRequest(requestId, req.path, req.method);
  }

  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const duration = Date.now() - startTime;
      const userId = (req.user as any)?.id;
      const metadata = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userId,
      };
      
      logger.endRequest(requestId, res.statusCode, userId);
      
      if (res.statusCode >= 500) {
        logger.error(`${req.method} ${req.path}`, undefined, metadata);
      } else if (res.statusCode >= 400) {
        logger.warn(`${req.method} ${req.path}`, metadata);
      } else {
        logger.info(`${req.method} ${req.path}`, metadata);
      }
    }
  });

  next();
}

export function errorLoggingMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error', err, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: (req.user as any)?.id,
  });
  next(err);
}

export function logServerStart(port: number) {
  logger.info(`Server started`, {
    metadata: {
      port,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    },
  });
}

export function logDatabaseConnection(success: boolean, error?: Error) {
  if (success) {
    logger.info('Database connected successfully');
  } else {
    logger.error('Database connection failed', error);
  }
}

export function logAuthEvent(event: 'login' | 'logout' | 'signup' | 'password_reset', userId: string, success: boolean, requestId?: string) {
  const message = success ? `${event} successful` : `${event} failed`;
  const logFn = success ? logger.info.bind(logger) : logger.warn.bind(logger);
  logFn(message, { requestId, userId, metadata: { event } });
}
