# Das Story Engine — Developer Runbook

## Run locally

```bash
cd das-story-engine
npm install
cp .env.example .env      # set DSE_BEARER_TOKEN to any secret string
npm run dev               # MCP server on http://localhost:8787/mcp
```

The local run uses the file-backed `MemoryStore` (state persisted to
`.data/store.json`, gitignored). No database needed.

## Test

```bash
npm test          # vitest — store + every tool
npm run typecheck
```

## Exercise the server by hand

```bash
TOKEN=$(grep DSE_BEARER_TOKEN .env | cut -d= -f2)
curl -s http://localhost:8787/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

A request without the correct token gets a 401 before any tool runs.

## Switch to real Supabase (later)

1. Apply the migrations in `supabase/migrations/` (in order) to your project.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` (or Cloudflare secrets).
3. Restart — the server picks `SupabaseStore` automatically when both are set.

## Deploy to Cloudflare (later)

`wrangler.toml` is committed. Set secrets, then deploy:

```bash
npx wrangler secret put DSE_BEARER_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler deploy
```

Then add the deployed URL as a custom connector in Claude.

## Add a future API (the plug-board)

Copy the adapter template in `src/integrations/`, fill in its three parts
(name, tools, secrets it needs), and register it in `src/integrations/index.ts`.
No other file changes.
