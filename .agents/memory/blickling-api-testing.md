---
name: Blickling API curl testing
description: Headers and setup needed to exercise the Fieldbook API from the shell in dev.
---
The API's CSRF middleware rejects any non-GET request unless BOTH headers are present: `Origin: <protocol>://<host of request>` (or APP_ORIGIN if set) and `X-Requested-With: BlicklingFieldbook`.

**Why:** custom same-origin check in the API server's security middleware; plain curl gets 403 "Request origin could not be verified".

**How to apply:** for local curl tests use `-H "Origin: http://localhost:8080" -H "X-Requested-With: BlicklingFieldbook"` plus a cookie jar from `/api/auth/login`. A dev-only admin exists (devadmin@example.com) created via `/api/auth/setup` with SETUP_SECRET; dev and production databases are separate.

Also: OpenAPI codegen (`pnpm --filter @workspace/api-spec run codegen`) fails on duplicate exported names if two operations use identical inline request-body shapes — give bodies named component schemas instead.
