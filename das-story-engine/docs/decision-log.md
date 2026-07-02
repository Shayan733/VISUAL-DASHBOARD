# Decision Log

## 2026-07-02 — Initial build (Phases 1–3)

- **Lives inside the visual-dashboard repo** as `/das-story-engine` — one system,
  modules as tabs (founder decision).
- **Local-first build**: no live Supabase migrations applied; `MemoryStore`
  (file-backed JSON) is the default store, `SupabaseStore` activates via env vars.
  Migrations are committed as SQL files only (founder decision: no real data touched).
- **Transport**: MCP streamable HTTP on a local Node server now; Workers entry stub +
  `wrangler.toml` committed so the Cloudflare deploy later is config-only.
- **Auth**: single bearer token via `DSE_BEARER_TOKEN`; checked before any tool runs.
- **Spines and scene prose are versioned, never overwritten** (append-only rows).
- **Scene cards reject an empty `turn`** — a scene that doesn't turn isn't a scene.
- Prompts (`prompts/*.md`) are placeholders; final creative text comes from a
  founder+Claude story session (per architecture doc's specialist notes).
