import * as Sentry from "@sentry/node";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Initialize Sentry with enhanced configuration
 * Includes performance monitoring, profiling, and Prisma integration
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info("Sentry DSN not configured - error tracking disabled");
    return;
  }

  try {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || env.NODE_ENV || "production",
      
      // Performance monitoring - sample 10% of transactions
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      
      // Profiling - sample 10% for CPU/memory insights (requires @sentry/profiling-node)
      // profilesSampleRate: 0.1,
      
      // Release tracking (from package.json version or git commit)
      release: process.env.npm_package_version || process.env.RENDER_GIT_COMMIT,
      
      // Ignore common/expected errors
      ignoreErrors: [
        // Browser-related errors
        "Non-Error exception captured",
        "Non-Error promise rejection captured",
        // Network errors (user's connection issues)
        "ETIMEDOUT",
        "ECONNREFUSED",
        "ECONNRESET",
        "EPIPE",
        // Expected application errors
        "Too Many Requests",
        "Rate limit exceeded",
        "VALIDATION_ERROR",
        // Aborted requests (user navigated away)
        "aborted"
      ],
      
      // Filter and modify events before sending
      beforeSend(event, hint) {
        // Don't send errors from health check endpoints
        if (event.request?.url?.includes("/health") || 
            event.request?.url?.includes("/metrics")) {
          return null;
        }
        
        // Redact sensitive headers
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
          delete event.request.headers["x-api-key"];
        }
        
        // Redact sensitive data from request body
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) data.password = "[REDACTED]";
          if (data.token) data.token = "[REDACTED]";
          if (data.secret) data.secret = "[REDACTED]";
        }
        
        return event;
      },
      
      // Filter noisy breadcrumbs
      beforeBreadcrumb(breadcrumb, hint) {
        // Filter out console.log breadcrumbs
        if (breadcrumb.category === "console" && breadcrumb.level === "log") {
          return null;
        }
        
        // Filter out http breadcrumbs to health endpoints
        if (breadcrumb.category === "http" && 
            breadcrumb.data?.url?.includes("/health")) {
          return null;
        }
        
        return breadcrumb;
      }
    });

    logger.info("Sentry initialized successfully", {
      environment: process.env.SENTRY_ENVIRONMENT || env.NODE_ENV,
      sampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1")
    });
  } catch (error) {
    logger.error("Failed to initialize Sentry", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Capture exception with additional context
 * Use this instead of Sentry.captureException for richer context
 */
export function captureException(
  error: Error,
  context?: {
    userId?: string;
    clientId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
  }
): void {
  Sentry.withScope((scope) => {
    // Set user context
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    
    // Set tags for filtering in Sentry
    if (context?.clientId) {
      scope.setTag("clientId", context.clientId);
    }
    
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    
    // Set extra context data
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    
    // Set severity level
    if (context?.level) {
      scope.setLevel(context.level);
    }
    
    Sentry.captureException(error);
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    
    scope.setLevel(level);
    Sentry.captureMessage(message);
  });
}

/**
 * Start a performance transaction
 * Use for tracking specific operations
 * Note: Requires Sentry performance monitoring enabled
 */
export function startTransaction(
  name: string,
  op: string = "http.server"
): void {
  // Transaction tracking - implement when needed
  Sentry.addBreadcrumb({
    message: `Transaction: ${name}`,
    category: "transaction",
    data: { op }
  });
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level: "info",
    data
  });
}
