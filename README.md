# VISUAL-DASHBOARD

One system, two modules:

- **Canvas** (repo root) — a visual system-design canvas: drag nodes, group them,
  connect them, attach files, and sync per-user canvases to Firebase
  (Auth + Firestore + Storage). Vanilla HTML/CSS/JS, no build step.
- **Das Story Engine** (`das-story-engine/`) — a TypeScript MCP server that powers the
  Das Production story pipeline (Claude is the brain, the database is the memory,
  Notion is the delivery shelf). See `das-story-engine/README` docs.

## Canvas app

Run locally (needed for template fetches):

```bash
npm install
npm run dev     # static server via `serve`
npm test        # vitest — sanitization/migration suite
npm run lint    # eslint over js/
```

### Security model

- All incoming canvas data (Firestore loads, share links, JSON imports, templates,
  snapshot restores) passes through `Sanitize.validateState` (`js/sanitize.js`):
  colors are hex-only, URLs are http/https-only, structure is normalized, and the
  legacy template schema is migrated automatically.
- Server-side access control lives in `firestore.rules` / `storage.rules` — deploy with
  `firebase deploy --only firestore:rules,storage,firestore:indexes`. The rules files
  in this repo are the source of truth; don't hand-edit rules in the console.
- The Firebase web API key in `js/config.js` is **public by design** (it identifies the
  project; it does not grant access). Access is enforced by the security rules.

### Known follow-ups

See `docs/dashboard-review-backlog.md` for the prioritized backlog from the 2026-07
code review (persistence unification, drag-performance work, ESM/Vite migration,
CSP, accessibility, version-history UI).
