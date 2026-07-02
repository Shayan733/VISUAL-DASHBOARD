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

## Test it with Claude Desktop (local, no deploy)

This is the fastest way to actually talk to the engine from Claude — no
Cloudflare, no public URL, no bearer token (the client launches the process, so
the OS process boundary is the trust boundary).

1. Install dependencies once: `cd das-story-engine && npm install`.
2. Find your Node/npx path: `which npx` (e.g. `/usr/local/bin/npx`).
3. Open Claude Desktop → Settings → Developer → Edit Config
   (`claude_desktop_config.json`) and add:

```json
{
  "mcpServers": {
    "das-story-engine": {
      "command": "npx",
      "args": ["tsx", "src/server/stdio.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/das-story-engine"
    }
  }
}
```

   Replace `cwd` with the absolute path to the `das-story-engine` folder. If
   `npx` isn't on Claude Desktop's PATH, use the full path from step 2 as
   `command`.

4. Restart Claude Desktop. You should see the 8 story tools under the
   tools (🔌) menu.
5. Try it: *"Start a new story project called Rooftop from this brief: …"* →
   Claude calls `create_project`. Then walk the pipeline: spine → phases →
   plants → scene cards → prose → approve. In a fresh chat, ask *"where were we
   on Rooftop?"* to see `get_project_state` recall it.

State persists to `das-story-engine/.data/store.json` (gitignored). To start
clean, delete that file.

### Verify without Claude (sanity check)

The stdio server speaks plain JSON-RPC, so you can drive it from a shell:

```bash
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 | npm run -s stdio
```

You'll get the initialize response and the list of 8 tools.

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
