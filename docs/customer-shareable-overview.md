# PulseOS - Customer-Shareable Overview

PulseOS is an AI-powered social media copilot for Instagram creators and small businesses in India. It handles Instagram content, analytics, WhatsApp automation, and growth — acting like a smart consulting partner so creators and business owners can focus on what they do best.

This document is safe to share with customers, mentors, partners, or pilot stakeholders.

It intentionally excludes:
- seeded demo credentials
- internal runbook steps
- private environment details
- operator-only troubleshooting notes

## What PulseOS is

PulseOS is a lightweight operations and automation platform for small businesses that want a simpler way to manage customer conversations, reporting, and assisted workflows without a large technical team.

The current product direction is designed around practical day-to-day use by MSMEs and small business operators in Odisha, India.

## What the product focuses on today

- clean dashboards and guided workflows
- analytics and reporting surfaces
- assisted content and insight generation
- queue-backed background processing for reliability
- tenant-aware backend controls for multi-business use

## Delivery posture

The platform is built on:
- Node.js + TypeScript + Express
- PostgreSQL via Prisma
- Redis + BullMQ for background jobs
- authenticated API access and signed webhooks

Recent hardening work in the codebase includes:
- authenticated protection on agent execution routes
- safer structured logging with sensitive field redaction
- stricter logo URL validation to reduce SSRF-style risk
- fallback support for encryption key rotation
- Redis-backed rate-limit storage for multi-instance behavior

## What this document is not

This is not an operator deployment guide and not a production credential sheet.

For internal-only material such as seeded accounts, smoke-test steps, Render runbooks, and incident response, use the operator docs inside `docs/` and keep them private to your team.

## Suggested external references

- [mvp-product.md](./mvp-product.md)
- [incubation-readiness.md](./incubation-readiness.md)
- [mvp-status-one-pager.md](./mvp-status-one-pager.md)
- [government/README.md](./government/README.md)
