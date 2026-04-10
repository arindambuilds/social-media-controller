import { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

/**
 * Request logging middleware
 * Logs all API requests with timing, status, and user context
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Skip logging for health check endpoints to reduce noise
  if (req.path.includes("/health") || req.path.includes("/metrics")) {
    next();
    return;
  }

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    
    const logData = {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      userId: req.auth?.userId,
      clientId: req.auth?.clientId,
      referer: req.get("referer")
    };

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error("Request failed (5xx)", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request client error (4xx)", logData);
    } else if (duration > 5000) {
      logger.warn("Slow request (>5s)", logData);
    } else if (duration > 2000) {
      logger.info("Request completed (slow)", logData);
    } else {
      logger.debug("Request completed", logData);
    }
  });

  next();
}

/**
 * Performance logging for specific critical endpoints
 * Use this for endpoints you want to always track performance on
 */
export function performanceLogger(endpointName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      
      logger.info("endpoint_performance", {
        endpoint: endpointName,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        userId: req.auth?.userId
      });
    });
    
    next();
  };
}
