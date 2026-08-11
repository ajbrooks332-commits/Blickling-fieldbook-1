# Blickling Fieldbook project guide

This is a pnpm/TypeScript monorepo deployed as one Replit Autoscale web application. The Express API serves the compiled Vite PWA in production.

## Source of truth

- Database: `lib/db/src/schema`
- API contract: `lib/api-spec/openapi.yaml`
- API routes: `artifacts/api-server/src/routes`
- Frontend: `artifacts/blickling-fieldbook/src`
- Startup migrations: `artifacts/api-server/src/lib/migrations.ts`

After changing OpenAPI, run `pnpm --filter @workspace/api-spec run codegen`. Before committing, run `pnpm run check` and `git diff --check`.

Never use `drizzle-kit push` against production. Production migrations run transactionally at API startup. Never add default credentials or reintroduce reset endpoints. Operational data is estate-scoped and records use soft archive.

Required deployment secrets and first-run instructions are documented in `README.md`.
