# Dashboard Review Backlog

Findings from the full code review (2026-07) that are **documented but not yet fixed**.
The security and critical-bug fixes landed on `das-writer-dashboard-test`; these are
the follow-up phases.

## Phase: Core product flows

- **Single persistence model.** localStorage autosave (`js/state.js` — 30 s interval,
  `State.load()` never called) still coexists with Firestore. Decide: Firestore is the
  source of truth when signed in; keep localStorage only as a crash-recovery fallback
  when a cloud save fails. Add a save-status chip (dirty/saving/saved/error) via a new
  `Sync.onStatus(cb)`; stop swallowing errors in `saveCanvas`; use `.set({merge:true})`;
  flush on `visibilitychange → hidden` (beforeunload can't await).
- **Debounce canvas-switch race.** Capture `canvasId` when the idle timer is armed and
  compare at fire time so canvas A's state can't be written into canvas B's doc.
- **Undoable property edits.** `State.updateNode` never pushes history. Add
  `History.pushDebounced(400)`; text inputs use it, discrete actions (swatch click,
  status change, collapse toggle) push directly.
- **Welcome/template flow.** `WelcomeModal.show()` is never called. Show it after auth
  when the user has zero canvases; template pick → `Sync.createCanvas` → load → save.
  (The legacy template schema is already migrated automatically by
  `Sanitize.validateState`.)
- **Fit view after every canvas load**, not just the initial one.
- **Wire `FileStorage.deleteEntityAttachments`** into node deletion (implemented but
  never called → orphaned Storage files).
- **Suppress click-after-drag** opening the properties panel (`js/app.js` onNodeClick).

## Phase: Performance

- `js/drag.js` calls `ConnectionRenderer.renderAll()` on **every mousemove** — rebuild
  only connections touching moved nodes (`updateForNodes(nodeIds)` with a
  `Map<connId, elements>`), coalesce into `requestAnimationFrame`, stop deleting
  `<defs>` each render.
- Minimap: remove the always-on `setInterval(render, 200)` (`js/minimap.js`); render on
  state/transform events, rAF-throttled.
- Drag-end: targeted `renderNode` instead of `renderAll`.

## Phase: Production hardening

- **ES modules + Vite**: convert the 21 hand-ordered script tags to real modules,
  hashed build filenames (drop manual `?v=` strings), Vitest imports directly.
- **CSP meta tag** (script-src self + gstatic + cdnjs; connect-src Firebase) — requires
  removing the inline `onclick` handlers in `index.html` (auth modal) first.
- **Firestore doc-size guard**: warn near the 1 MB per-document limit (~800 KB
  serialized); enable offline persistence.
- **Accessibility**: `aria-label` on icon-only buttons, `role="dialog"` + focus trap on
  modals, `aria-live` toasts.
- **corsproxy.io**: every pasted link is sent to a third party for OG scraping
  (`js/attachments.js` fetchOG). Default to hostname-only titles or proxy via a Cloud
  Function.
- CSS token cleanup: unused `--grid-dot`/`--grid-size`, legacy `--surface-3/4`
  duplicates.

## Phase: Product enhancements

- **Version-history UI** — snapshot save/list/restore already fully implemented in
  `js/sync.js` (no UI). Snapshots now carry `userId` and rules allow owner access, so
  this is UI-only work.
- **Share links v2** — replace the length-limited base64 `#state=` URL with a Firestore
  `shares/{id}` doc + public-read rule for explicitly shared canvases.
- **Multi-tab awareness** — `onSnapshot` on the open canvas doc → "updated in another
  tab" toast.

## Deployment reminders (founder action)

- Deploy the new rules: `firebase deploy --only firestore:rules,storage,firestore:indexes`.
  Until then, access control is client-side only.
- Old snapshots written before this change lack `userId` and will be inaccessible under
  the new rules (they only had `createdBy`). Backfill or accept the loss.
