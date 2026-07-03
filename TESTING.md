# Testing Guide — Visual Dashboard × Das Story Engine

How to run and test the whole system by hand, what should work, and what to poke
at to catch bugs.

## 0. How the system fits together (read this first)

There are **two separate apps** in this repo. They are **not connected at
runtime** — they only share a navigation tab. Test each on its own.

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  CANVAS (browser app)       │        │  DAS STORY ENGINE (MCP server)│
│  index.html + js/*.js        │        │  das-story-engine/            │
│                              │        │                              │
│  runs in: a browser          │        │  runs in: Node, launched by  │
│  talks to: Firebase          │        │           Claude Desktop     │
│  (Auth + Firestore + Storage)│        │  talks to: Claude (MCP tools)│
│                              │        │  stores to: local JSON file  │
│                              │        │             (or Supabase)    │
└─────────────────────────────┘        └──────────────────────────────┘
        │  tab: "Das Writer"  ──────────────►  das.html (a static info page)
        ▲                                              │
        └──────────  tab: "Canvas"  ◄──────────────────┘
```

- **Canvas ↔ Engine share no data.** The "Das Writer" tab opens `das.html`, an
  info page. It does NOT send your canvas into the story engine. (Deep
  integration is future work.)
- So "full end-to-end" today means: (A) the Canvas app works against Firebase,
  and (B) the Engine works as MCP tools inside Claude. Two flows, tested
  separately.

Prerequisites: Node 18+, a browser, and (for the engine) Claude Desktop.

---

## Part A — Test the Canvas app

### Run it
```bash
npm install
npm run dev          # static server (needed — templates load via fetch)
```
Open the printed URL (e.g. http://localhost:3000). Do NOT open `index.html`
directly with `file://` — fetch and Firebase auth break.

### Sign-in gate
The canvas is hidden until you sign in (Google or email magic link). Two things
to know:
- Auth uses the real Firebase project in `js/config.js`, so sign-in works out of
  the box.
- **Data reads/writes only fully work once the security rules are deployed**
  (`firebase deploy --only firestore:rules,storage,firestore:indexes`). Until
  then you may see permission errors in the console when saving/listing
  canvases. This is the one deploy step still on you.

### Bypass auth to test the canvas quickly
Every canvas has a **Share** button (toolbar) that copies a `#state=...` URL.
Opening that URL loads a **read-only** canvas with NO sign-in — handy for testing
rendering, and for testing the security fixes (see below).

### Canvas test cases — what should work
Work through these; each line is a pass/fail check.

**Nodes & editing**
- [ ] Double-click empty canvas → command palette → pick a type → node appears
- [ ] Drag a node — it moves; connections follow
- [ ] Double-click a node label → edit inline → Enter saves, Esc cancels
- [ ] Open properties panel (click node) → change label, description, color,
      status, owner, due date → node updates live
- [ ] Resize a node from its corner handle
- [ ] Delete a node (Del key or toolbar) → its connections disappear too

**Groups & stickies**
- [ ] Add a group; drag a node into it → node re-parents (moves with the group)
- [ ] Collapse/expand a group
- [ ] Add a sticky note; type in it; link it to a node (right-click → Link)

**Connections**
- [ ] Drag from a node's port to another node → connection with arrow
- [ ] Double-click a connection → set a label
- [ ] Connection takes the source node's color

**Canvas controls**
- [ ] Pan (drag empty space), zoom (scroll / toolbar), Fit View, minimap click
- [ ] Undo/redo (⌘Z / ⌘⇧Z) across add/move/delete
- [ ] **Undo a property edit** (label/color/status) — should now be undoable
- [ ] Box-select multiple, ⌘D duplicate, ⌘A select all

**Persistence & multi-canvas** (needs rules deployed)
- [ ] ⌘S or Save → toast says "Saved to cloud ✓"; reload → work is still there
- [ ] Sidebar: New canvas, switch between canvases, Rename, Recolor, Duplicate,
      Delete — all persist after reload
- [ ] **⌘Z right after switching canvases must NOT pull the other canvas in**

**Import/export/share**
- [ ] Export JSON → re-import it → identical canvas
- [ ] Export PNG downloads an image
- [ ] Share → open the copied link in a private window → read-only canvas

**Attachments**
- [ ] Drag a file onto a node (or Upload in properties) → badge appears
      (needs Storage rules deployed)
- [ ] Paste a link → it attaches with the site's hostname as the title
- [ ] Delete an attachment → badge count updates live

### Canvas — security checks (the point of this branch)
- [ ] Import a JSON file with a node whose **color** is
      `"><img src=x onerror=alert(1)>` → NO alert; node renders with a safe
      default color
- [ ] Same payload in a node **label**, a **sticky**, an **attachment URL**, and
      the node **id** → NO alert anywhere
- [ ] Build a Share link from a canvas containing those payloads, open it → NO
      alert (the share path validates too)
- [ ] Open DevTools console: you should NOT see CSP violations during normal use
      (a violation means a real feature is hitting the policy — note which one)

### Canvas — automated
```bash
npm test        # 38 vitest tests: XSS payload corpus + legacy-template migration
npm run lint    # eslint over js/
```

---

## Part B — Test the Story Engine (inside Claude Desktop)

This is the "full app" for the engine: Claude drives the tools.

### Connect it (no deployment needed)
1. `cd das-story-engine && npm install`
2. Claude Desktop → Settings → Developer → Edit Config, add:
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
3. Restart Claude Desktop → the 8 tools appear in the 🔌 menu.

(Full details + a no-Claude shell check are in `das-story-engine/docs/dev.md`.)

### Engine test cases — the happy path
Say these to Claude in order; watch which tool it calls and the result:
- [ ] "Start a new story called **Rooftop** from this brief: *a family covers up
      a death on their rooftop.*" → `create_project`, returns an id
- [ ] "The spine is: want …, stakes …, hero believes …, villain believes …" →
      `save_spine` (version 1, not approved)
- [ ] "Lock the spine." → `save_spine` again, approved: true, version 2
- [ ] "Here are the 8 phases: …" → `save_phases`, phases_saved: 8
- [ ] "Plants: the cracked watch (scene 1, pays off scene 7); the second phone
      (scene 2, no payoff yet)." → `save_plants`, reports 1 orphan
- [ ] "Scene 1 card: who…, want…, block…, turn…" → `save_scene_card`
- [ ] "Write the prose for scene 1." → `save_scene_prose` (state: draft)
- [ ] "Approve scene 1." → `approve_scene` (state: approved)
- [ ] **New chat**: "Where were we on Rooftop?" → `get_project_state` recalls
      spine/phases/plants/scenes — **this is the core promise; verify it works
      across a fresh chat**

### Engine test cases — the guardrails (these SHOULD fail on purpose)
- [ ] Save a scene card with an **empty turn** → refused with a clear message
- [ ] **Approve a scene that has no prose** → refused
- [ ] Save prose for a scene number with **no card** → refused
- [ ] Save phases that aren't numbered 1–8 / have duplicates → refused
- [ ] "Where were we on a story that doesn't exist?" → clean "no project" answer

### Engine — persistence & versioning
- [ ] Save a spine twice → old version is kept (append-only), latest wins
- [ ] Re-write prose for an approved scene → it drops back to **draft**
- [ ] Quit Claude Desktop, reopen, "where were we?" → still there
      (state lives in `das-story-engine/.data/store.json`; delete it to reset)

### Engine — automated
```bash
cd das-story-engine
npm test         # 18 tests: store + every tool, incl. all guardrails
npm run typecheck
```

---

## Part C — What works vs what's not built (set expectations)

**Working now**
- Canvas app: all editing, groups, connections, undo, import/export/PNG/share,
  attachments, security sanitization (verified by tests).
- Engine: all 8 pipeline tools, versioning, guardrails, session recall, local
  file persistence, Claude Desktop connection (stdio), local HTTP + bearer auth.

**Works only after YOU act**
- Canvas cloud save / multi-canvas / attachments need the **Firebase rules
  deployed** (one command). Auth already works.
- Engine on **phone / claude.ai** needs the Cloudflare Workers deploy (the
  Workers transport is still a stub) + adding the URL as a connector. Claude
  Desktop needs none of this.
- Engine on a **real database** needs Supabase env vars set (uses a local file
  until then).

**Not built yet (deferred — see docs/dashboard-review-backlog.md and the PRD)**
- Engine: audit engine (Phase 4), Notion push (Phase 5), the das-writer skill
  rewrite (Phase 6), the plug-board example (Phase 7).
- Canvas ↔ Engine deep integration (the tab is navigation only).
- Dashboard backlog: drag-performance work, ES-modules/Vite build, version-
  history UI, welcome/template modal auto-show.

---

## Part D — Where bugs are most likely (look here first)

- **Canvas save race / rules**: if saves silently fail, open the console — it's
  almost always a Firestore permission error (rules not deployed) vs a code bug.
- **Undo across canvas switch**: exercised and fixed, but the highest-risk area
  historically — hammer it (switch canvas, immediately ⌘Z, repeat).
- **Group re-parenting math**: drag nodes in and out of groups, then move the
  group — child positions should stay put, not jump.
- **Attachments live-refresh**: upload/delete with the properties panel open —
  the list should update in place.
- **Engine "where were we" after re-write**: approve a scene, re-write its
  prose, ask for state — it should show `draft`, not `approved`.
- **Engine title lookup collisions**: two projects with the same title — the
  engine matches the first; use the project id to disambiguate.

When you find a bug, note: which app, exact steps, what you expected, what
happened, and anything in the browser console / Claude Desktop logs.
