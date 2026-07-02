/* Cloudflare Workers entry — DEPLOY-LATER STUB.
 *
 * The working path today is the local Node server (src/server/index.ts).
 * This file + wrangler.toml exist so moving to Cloudflare later is
 * config-only: set the secrets and `npx wrangler deploy`.
 *
 * Implementation note for the deploy step: on Workers, swap the express
 * transport for a fetch-based one (the MCP SDK's WebStream transport or
 * the `agents/mcp` helper), keep buildMcpServer(createStore(env)) as the
 * core, and read DSE_BEARER_TOKEN / SUPABASE_* from `env` (Workers
 * secrets) instead of process.env. MemoryStore's file persistence does
 * not exist on Workers — Supabase env vars are required there.
 */

interface Env {
  DSE_BEARER_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

/* Constant-time comparison via SHA-256 digests (equal lengths, no
   content/length timing leak) — mirrors the local server's check. */
async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get('authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!env.DSE_BEARER_TOKEN || !(await tokenMatches(provided, env.DSE_BEARER_TOKEN))) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unauthorized' },
          id: null,
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            'Das Story Engine Workers deployment is not wired yet — ' +
            'run the local server (npm run dev) or complete the deploy step in docs/dev.md.',
        },
        id: null,
      }),
      { status: 501, headers: { 'content-type': 'application/json' } },
    );
  },
};
