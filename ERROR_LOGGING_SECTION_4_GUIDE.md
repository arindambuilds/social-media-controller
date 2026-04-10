# 🔧 SECTION 4 — ERROR HANDLING & LOGGING COMPLETE GUIDE

This document provides comprehensive error handling, logging, and monitoring setup for production.

---

## ✅ CURRENT STATE ANALYSIS

### What Already Exists (Excellent!):

✅ **Winston Logger** (`src/lib/logger.ts`)
- Structured JSON logging
- PII/sensitive data redaction
- Timestamp and service metadata
- Metric logging function

✅ **Error Handler Middleware** (`src/middleware/errorHandler.ts`)
- Handles ZodError, PrismaClientError, JSON parsing errors
- Sentry integration (conditional on SENTRY_DSN)
- Production-safe error messages

✅ **Sentry Integration** (`src/app.ts`)
- Basic Sentry.init() with DSN
- Error handler setup

✅ **Security Headers** (`src/app.ts`)
- Helmet with strict CSP, HSTS, Referrer-Policy

### What Needs Enhancement:

❌ Request logging middleware (log all API calls)
❌ Sentry configuration optimization
❌ Health check endpoint with detailed diagnostics
❌ API monitoring dashboard
❌ Alert configuration

---

## ✅ 4.1 — GLOBAL ERROR HANDLING

### Enhance Error Handler

Your error handler is already good! Let's add a few enhancements:

**File:** `src/middleware/errorHandler.ts` (enhancements)

Add these error types at the top:

```typescript
// Add after existing imports
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}
```

Then update the error handler to handle these:

```typescript
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProd = env.NODE_ENV === "production";

  // Handle AppError (our custom errors)
  if (err instanceof AppError) {
    logger.warn("Application error", {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method
    });
    
    // Only send to Sentry if it's not operational (unexpected error)
    if (!err.isOperational && env.SENTRY_DSN) {
      Sentry.captureException(err);
    }
    
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: isProd && err.statusCode >= 500 ? "Something went wrong" : err.message
      }
    });
    return;
  }

  // ... rest of existing error handling (ZodError, Prisma, etc.)
}
```

### Add Request Logging Middleware

**File:** `src/middleware/requestLogger.ts` (create new)

```typescript
import { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

/**
 * Logs all API requests with timing
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Capture response details
  const originalSend = res.send;
  let responseBody: unknown;
  
  res.send = function (data: unknown): Response {
    responseBody = data;
    return originalSend.call(this, data);
  };

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      userId: req.auth?.userId,
      clientId: req.auth?.clientId
    };

    if (res.statusCode >= 500) {
      logger.error("Request failed", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request client error", logData);
    } else {
      logger.info("Request completed", logData);
    }
  });

  next();
}
```

**Apply it in `src/app.ts`:**

```typescript
import { requestLogger } from "./middleware/requestLogger";

// Add after morgan but before routes
app.use(requestLogger);
```

### Enhanced Health Check Endpoint

**File:** `src/routes/health.ts` (enhance existing)

```typescript
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { env } from "../config/env";

export const healthRouter = Router();

// Basic health check (fast, no auth required)
healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV
  });
});

// Detailed health check (includes database, redis checks)
healthRouter.get("/detailed", async (_req, res) => {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    checks: {
      database: { status: "unknown", latency: 0 },
      redis: { status: "unknown", latency: 0 },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      }
    }
  };

  // Check database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = {
      status: "healthy",
      latency: Date.now() - start
    };
  } catch (error) {
    checks.status = "unhealthy";
    checks.checks.database = {
      status: "unhealthy",
      latency: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  // Check Redis
  if (redisConnection) {
    try {
      const start = Date.now();
      await redisConnection.ping();
      checks.checks.redis = {
        status: "healthy",
        latency: Date.now() - start
      };
    } catch (error) {
      checks.status = "degraded"; // Redis is optional
      checks.checks.redis = {
        status: "unhealthy",
        latency: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    checks.checks.redis = {
      status: "disabled",
      latency: 0
    };
  }

  const statusCode = checks.status === "healthy" ? 200 : checks.status === "degraded" ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Liveness probe (for Kubernetes/Render)
healthRouter.get("/live", (_req, res) => {
  res.status(200).send("OK");
});

// Readiness probe (for Kubernetes/Render)
healthRouter.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).send("OK");
  } catch (error) {
    res.status(503).send("NOT READY");
  }
});
```

---

## ✅ 4.2 — LOGGING ENHANCEMENTS

### Your Winston Logger is Excellent!

The existing `src/lib/logger.ts` already has:
- ✅ PII redaction
- ✅ Structured JSON format
- ✅ Timestamps
- ✅ Error stack traces
- ✅ Metric logging

### Additional Log Categories

Add these helper functions to `src/lib/logger.ts`:

```typescript
// Add at the end of the file

/**
 * Log security events (auth failures, suspicious activity)
 */
export function logSecurityEvent(
  event: string,
  details: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    [key: string]: unknown;
  }
): void {
  logger.warn("security_event", {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log business metrics (signups, conversions, revenue)
 */
export function logBusinessMetric(
  metric: string,
  value: number | string,
  metadata?: Record<string, unknown>
): void {
  logger.info("business_metric", {
    metric,
    value,
    ...metadata,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log API performance
 */
export function logApiPerformance(data: {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  userId?: string;
}): void {
  const level = data.duration > 5000 ? "warn" : data.duration > 2000 ? "info" : "debug";
  logger.log(level, "api_performance", data);
}
```

### Log Rotation (for non-cloud deployments)

If you're not using a cloud logging service, add log rotation:

```typescript
// In src/lib/logger.ts, add to transports array:
import DailyRotateFile from "winston-daily-rotate-file";

const transports: winston.transport[] = [new winston.transports.Console()];

if (process.env.NODE_ENV === "production") {
  transports.push(
    new DailyRotateFile({
      filename: "logs/application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d", // Keep logs for 14 days
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );
}

export const logger = winston.createLogger({
  // ... existing config
  transports
});
```

---

## ✅ 4.3 — MONITORING & ALERTS (SENTRY)

### Sentry Setup (Detailed)

**STEP 1: Create Sentry Account**

1. Go to https://sentry.io/signup/
2. Create free account (50k events/month)
3. Create new project → Choose "Node.js"
4. Copy DSN: `https://xxx@xxx.ingest.sentry.io/xxx`

**STEP 2: Add to Environment Variables**

```bash
# Render Environment Variables
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production  # or staging, development
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
```

**STEP 3: Enhanced Sentry Configuration**

**File:** `src/lib/sentry.ts` (create new)

```typescript
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "../config/env";

export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
    
    // Performance monitoring
    tracesSampleRate: parseFloat(env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    
    // Profiling (CPU/memory usage)
    profilesSampleRate: 0.1,
    integrations: [
      nodeProfilingIntegration(),
      // Prisma integration
      new Sentry.Integrations.Prisma({ client: prisma })
    ],
    
    // Release tracking (from package.json version)
    release: process.env.npm_package_version,
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser errors that leak into server logs
      "Non-Error exception captured",
      "Non-Error promise rejection captured",
      // Network timeouts (often user's connection)
      "ETIMEDOUT",
      "ECONNREFUSED",
      // Rate limit errors (expected)
      "Too Many Requests"
    ],
    
    // Before send hook - modify or drop events
    beforeSend(event, hint) {
      // Don't send if error is from health check endpoint
      if (event.request?.url?.includes("/health")) {
        return null;
      }
      
      // Redact sensitive data from event
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      
      return event;
    },
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "log") {
        return null;
      }
      return breadcrumb;
    }
  });
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: {
    userId?: string;
    clientId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.clientId) {
      scope.setTag("clientId", context.clientId);
    }
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    Sentry.captureException(error);
  });
}
```

**STEP 4: Update `src/app.ts` to use new Sentry config:**

```typescript
import { initSentry } from "./lib/sentry";

// Replace existing Sentry.init() with:
initSentry();
```

**STEP 5: Configure Sentry Alerts**

1. Go to Sentry Dashboard → Alerts
2. Click "Create Alert Rule"
3. Configure alert for:
   - **Error Rate**: > 10 errors/minute
   - **New Issues**: Any new error type
   - **Performance Issues**: Response time > 5 seconds
4. Set notification channel: Email, Slack, PagerDuty
5. Save alert rule

**STEP 6: Test Sentry Integration**

```typescript
// Add test endpoint (remove after testing)
app.get("/test-sentry", () => {
  throw new Error("Test Sentry integration");
});

// Then visit: https://your-app.onrender.com/test-sentry
// Check Sentry dashboard for the error
```

### Configure Render Health Checks

**Manual Steps in Render Dashboard:**

1. Go to Render Dashboard → Your Service
2. Click "Settings" tab
3. Scroll to "Health Check Path"
4. Set to: `/api/health`
5. Save

This makes Render restart your service if health check fails.

---

## 📊 4.4 — API MONITORING DASHBOARD

### Option 1: Sentry Performance Monitoring (Recommended)

Already included in Sentry config above. View at:
- Sentry Dashboard → Performance
- See slowest endpoints
- Transaction traces
- Database query performance

### Option 2: Custom Metrics Dashboard

**File:** `src/routes/metrics.ts` (create new, admin-only)

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";

export const metricsRouter = Router();

metricsRouter.use(authenticate);
metricsRouter.use(requireRole("AGENCY_ADMIN"));

metricsRouter.get("/", async (_req, res) => {
  const [
    userCount,
    clientCount,
    briefingCount24h,
    errorCount24h
  ] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.briefing.count({
      where: { sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    }),
    prisma.systemEvent.count({
      where: {
        level: "error",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  res.json({
    users: userCount,
    clients: clientCount,
    briefings24h: briefingCount24h,
    errors24h: errorCount24h,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

---

## 📝 SECTION 4 COMPLETION CHECKLIST

### Code Changes:
- [ ] Add custom error classes (AppError, NotFoundError, etc.)
- [ ] Update error handler to use custom errors
- [ ] Create `src/middleware/requestLogger.ts`
- [ ] Add request logger to `src/app.ts`
- [ ] Enhance health check endpoints
- [ ] Add log helper functions (security, business metrics)
- [ ] Create `src/lib/sentry.ts` with enhanced config
- [ ] Update Sentry init in `src/app.ts`

### Configuration:
- [ ] Create Sentry account at sentry.io
- [ ] Get Sentry DSN
- [ ] Add SENTRY_DSN to Render environment
- [ ] Add SENTRY_ENVIRONMENT to Render
- [ ] Configure Sentry alerts (error rate, new issues)
- [ ] Set Render health check path to `/api/health`

### Testing:
- [ ] Test health check endpoints: `/api/health`, `/api/health/detailed`
- [ ] Test error logging (create intentional error)
- [ ] Verify Sentry receives errors
- [ ] Test Sentry alerts trigger
- [ ] Check request logging in production logs
- [ ] Verify sensitive data is redacted

### Testing Commands:

```bash
# 1. Test health checks
curl https://your-app.onrender.com/api/health
curl https://your-app.onrender.com/api/health/detailed

# 2. Test error handling
curl -X POST https://your-app.onrender.com/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
# Should return 400 with structured error

# 3. Check logs in Render
# Go to Render Dashboard → Logs
# Look for structured JSON logs with request details

# 4. Verify Sentry
# Go to Sentry Dashboard → Issues
# Should see test errors appear within 1 minute
```

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue: Sentry not receiving errors
**Solution**: 
- Check SENTRY_DSN is set correctly
- Verify `env.SENTRY_DSN` is truthy in code
- Check Sentry dashboard quota (free tier: 50k events/month)

### Issue: Too many logs in production
**Solution**:
- Set log level to "warn" or "error" in production
- Filter out noisy endpoints in request logger
- Use log sampling for high-traffic endpoints

### Issue: Health check fails randomly
**Solution**:
- Increase database connection pool size
- Add timeout to health check queries
- Use `/health/live` for liveness (no DB check)

---

## 📊 EXPECTED OUTCOMES

After completing Section 4:
- **100% error visibility** - All errors captured in Sentry
- **Request tracing** - Every API call logged with timing
- **Proactive alerts** - Get notified before users report issues
- **Performance insights** - Identify slow endpoints
- **Reduced MTTR** - Mean Time To Resolution < 15 minutes

---

**Next:** Proceed to Section 5 — Performance Optimization
