# AutoViral Data Core

Independent PostgreSQL + API foundation. This directory is isolated from the existing Vite app and Supabase integration.

## Current phase

- Neon PostgreSQL project created by the owner.
- API scaffold targets Cloudflare Workers.
- Database schema is versioned in `migrations/`.
- No production app module has been switched to this API.
- Supabase remains the legacy source until a verified export/import and reconciliation are completed.

## Local development

1. Install Node.js 22 or later.
2. From `data-core/api`, run `npm install`.
3. Set `DATABASE_URL` as a local secret (never commit it).
4. Run the migration manually against a disposable development database:
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../migrations/0001_core_foundation.sql`
5. Run `npm run dev` to start the Worker locally.

## Cloudflare deployment

Configure Worker secret `DATABASE_URL` in Cloudflare. Set `CORS_ORIGIN` to the exact deployed frontend origin. Deploy only after the database migration and security review.

## Security boundary

The first endpoint is health-only. Do not add public CRUD endpoints until authentication and workspace authorization are implemented and tested. Never expose `DATABASE_URL` in Vite `VITE_*` variables, browser code, GitHub commits, or client-side storage.

## Migration policy

- Take and verify a backup before any production copy.
- Preserve source IDs and timestamps.
- Use idempotent import batches and compare row counts/checksums.
- Keep the Supabase project and its data intact until owner approval after a rollback window.
