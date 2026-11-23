import { neon } from "@neondatabase/serverless";

interface Env {
  DATABASE_URL: string;
  CORS_ORIGIN: string;
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const corsHeaders: Record<string, string> = {
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "vary": "Origin",
    };

    if (origin && origin === env.CORS_ORIGIN) {
      corsHeaders["access-control-allow-origin"] = origin;
    }

    if (request.method === "OPTIONS") {
      if (origin && origin !== env.CORS_ORIGIN) {
        return json({ error: "origin_not_allowed" }, 403, corsHeaders);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      if (!env.DATABASE_URL) {
        return json({ status: "degraded", database: "not_configured" }, 503, corsHeaders);
      }

      try {
        const sql = neon(env.DATABASE_URL);
        const rows = await sql`select current_timestamp as checked_at, current_database() as database`;
        return json(
          { status: "ok", service: "autoviral-data-core", database: "connected", checkedAt: rows[0]?.checked_at },
          200,
          corsHeaders,
        );
      } catch {
        // Do not return connection details or database errors to public clients.
        return json({ status: "degraded", database: "unavailable" }, 503, corsHeaders);
      }
    }

    return json({ error: "not_found" }, 404, corsHeaders);
  },
};
