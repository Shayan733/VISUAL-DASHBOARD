# Das Story Engine — PRD

## What we are building

A story-writing engine for Das Production. Claude (chat or Code) is the brain. This
MCP server is the door. A database is the memory. The founder talks to Claude, Claude
calls the tools, every story step gets saved and versioned, and the finished screenplay
is pushed to Notion for the Calcutta team to shoot.

## Why

- **Kills the restore problem.** If a chat dies mid-script, a new chat asks
  "where were we?" — `get_project_state` answers from the database, exactly where work
  stopped.
- **Versioned creative memory.** Old spines and scene drafts are never deleted; quality
  changes are traceable to prompt/file changes.
- **Clean delivery.** Only audit-passed scripts ship to Notion — the workbench and the
  delivery shelf stay separate.

## Pipeline (tools in order)

1. `create_project` — title + brief → project row
2. `save_spine` — the 4 spine lines (want / stakes / hero belief / villain belief),
   versioned, approve to lock
3. `save_phases` — all 8 phase one-liners
4. `save_plants` — plant/payoff table; a plant is `orphan` until a payoff scene is set
5. `save_scene_card` — who / want / block / turn per scene (turn is mandatory)
6. `save_scene_prose` — prose attached to a card as a new version → state `draft`
7. `approve_scene` — founder-only flip draft → approved
8. `get_project_state` — compact summary at any time (the session memory)
9. *(Phase 4, future)* `run_audit_checks`, `flag_scene`
10. *(Phase 5, future)* `push_to_notion`

## Non-goals (now)

- No audit engine yet (Phase 4), no Notion push yet (Phase 5).
- No Cloudflare deployment from this build — the server runs locally; `wrangler.toml`
  is committed so deploying later is config-only.
- No live Supabase writes in this build — the `SupabaseStore` code exists but only
  activates when `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are set. Local runs use the
  file-backed `MemoryStore`.

## Security

- One secret bearer token, checked on every call before anything runs.
- Secrets live in `.env` locally / Cloudflare secret store in production — never in git.
- Every input shape is validated before writing (a scene card must have who/want/block/turn).
