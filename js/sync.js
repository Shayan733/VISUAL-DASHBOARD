/* ============================================
   Sync — Cloud persistence (Firestore)
   Replaces Supabase with Firebase Firestore.

   Save strategy:
   - Idle save: fires 5 s after the last state
     change, but ONLY when the user is not
     actively dragging or resizing.
   - Drag/resize end: immediate save triggered
     by drag.js calling Sync.debouncedSave().
   - Manual save: Ctrl+S calls Sync.saveCanvas()
   - Page unload: saveCanvas() called directly.
   - Every save is an UPDATE (upsert) of a single
     Firestore document — nothing ever accumulates.
   ============================================ */

const Sync = (() => {
  const IDLE_MS = 5000; // ms of inactivity before auto-save fires
  let idleTimer = null;
  let hasUnsavedChanges = false;

  /* ── helpers ── */

  const db = () => FirestoreDB.db;
  const canvasesCol = () => db().collection('canvases');
  const snapshotsCol = () => db().collection('canvas_snapshots');

  /* ── Core save ── */

  const saveCanvas = async () => {
    if (!State.currentCanvasId || !State.user) return;

    try {
      const state = State.toJSON();
      await canvasesCol().doc(State.currentCanvasId).update({
        stateJson: state,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      hasUnsavedChanges = false;
    } catch (e) {
      console.error('Save error:', e);
    }
  };

  /**
   * Called by state change listeners AND by drag.js on mouse-up.
   * Skips scheduling while actively dragging/resizing — drag.js
   * calls this again on finishNodeDrag / finishResize so the
   * final position is always persisted.
   */
  const debouncedSave = () => {
    hasUnsavedChanges = true;

    // Don't schedule a timer mid-drag — wait for mouse release
    if (Drag.isDragging || Drag.isResizing || Drag.isConnecting) return;

    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      if (hasUnsavedChanges && !Drag.isDragging && !Drag.isResizing) {
        await saveCanvas();
      }
    }, IDLE_MS);
  };

  /* ── Load ── */

  const loadCanvas = async (canvasId) => {
    if (!State.user) return;

    try {
      // Persist current canvas before switching
      if (State.currentCanvasId) await saveCanvas();

      const doc = await canvasesCol().doc(canvasId).get();

      if (!doc.exists || doc.data().userId !== State.user.id) {
        showToast('Canvas not found', 'error');
        return;
      }

      const data = doc.data();
      State.currentCanvasId = canvasId;
      State.loadFromJSON(data.stateJson || { nodes: [], connections: [] });
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
      Sidebar.updateActive(canvasId);
    } catch (e) {
      console.error('Load canvas error:', e);
      showToast('Failed to load canvas', 'error');
    }
  };

  const loadMostRecentCanvas = async () => {
    if (!State.user) return;

    try {
      const snapshot = await canvasesCol()
        .where('userId', '==', State.user.id)
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        await createCanvas('Untitled');
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      State.currentCanvasId = doc.id;
      State.loadFromJSON(data.stateJson || { nodes: [], connections: [] });
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    } catch (e) {
      console.error('Load most recent error:', e);
      if (!State.currentCanvasId) {
        await createCanvas('Untitled');
      }
    }
  };

  /* ── List ── */

  const listCanvases = async () => {
    if (!State.user) return [];

    try {
      const snapshot = await canvasesCol()
        .where('userId', '==', State.user.id)
        .orderBy('updatedAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        color: doc.data().color,
        updatedAt: doc.data().updatedAt,
      }));
    } catch (e) {
      console.error('List canvases error:', e);
      return [];
    }
  };

  /* ── Create ── */

  const createCanvas = async (name = 'Untitled', type = 'freeform') => {
    if (!State.user) return null;

    try {
      const docRef = await canvasesCol().add({
        userId: State.user.id,
        name,
        type,
        color: null,
        stateJson: { nodes: [], connections: [] },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      State.currentCanvasId = docRef.id;
      State.clear();
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
      Sidebar.refresh();
      return { id: docRef.id, name, type };
    } catch (e) {
      console.error('Create canvas error:', e);
      showToast('Failed to create canvas', 'error');
      return null;
    }
  };

  /* ── Delete ── */

  const deleteCanvas = async (canvasId) => {
    if (!State.user) return;

    try {
      // Delete canvas document
      await canvasesCol().doc(canvasId).delete();

      // Delete all snapshots for this canvas
      const snaps = await snapshotsCol()
        .where('canvasId', '==', canvasId)
        .get();
      const batch = db().batch();
      snaps.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      if (State.currentCanvasId === canvasId) {
        await loadMostRecentCanvas();
      }
      Sidebar.refresh();
      showToast('Canvas deleted', 'success');
    } catch (e) {
      console.error('Delete canvas error:', e);
      showToast('Failed to delete canvas', 'error');
    }
  };

  /* ── Duplicate ── */

  const duplicateCanvas = async (canvasId) => {
    if (!State.user) return;

    try {
      const doc = await canvasesCol().doc(canvasId).get();
      if (!doc.exists) {
        showToast('Failed to duplicate canvas', 'error');
        return;
      }
      const original = doc.data();

      await canvasesCol().add({
        userId: State.user.id,
        name: original.name + ' (copy)',
        color: original.color,
        type: original.type,
        stateJson: original.stateJson,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      Sidebar.refresh();
      showToast('Canvas duplicated', 'success');
    } catch (e) {
      console.error('Duplicate canvas error:', e);
      showToast('Failed to duplicate canvas', 'error');
    }
  };

  /* ── Canvas metadata (name / color) ── */

  const updateCanvasMeta = async (canvasId, updates) => {
    if (!State.user) return;
    try {
      await canvasesCol().doc(canvasId).update(updates);
    } catch (e) {
      console.error('Update canvas meta error:', e);
    }
  };

  /* ── Snapshots ── */

  const saveSnapshot = async (name) => {
    if (!State.currentCanvasId || !State.user) return;

    try {
      await snapshotsCol().add({
        canvasId: State.currentCanvasId,
        name,
        stateJson: State.toJSON(),
        createdBy: State.user.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast(`Snapshot "${name}" saved`, 'success');
    } catch (e) {
      console.error('Save snapshot error:', e);
      showToast('Failed to save snapshot', 'error');
    }
  };

  const listSnapshots = async (canvasId) => {
    try {
      const snapshot = await snapshotsCol()
        .where('canvasId', '==', canvasId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error('List snapshots error:', e);
      return [];
    }
  };

  const restoreSnapshot = async (snapshotId) => {
    try {
      const doc = await snapshotsCol().doc(snapshotId).get();
      if (!doc.exists) {
        showToast('Snapshot not found', 'error');
        return;
      }

      State.loadFromJSON(doc.data().stateJson);
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
      await saveCanvas();
      showToast('Snapshot restored', 'success');
    } catch (e) {
      console.error('Restore snapshot error:', e);
      showToast('Failed to restore snapshot', 'error');
    }
  };

  /* ── Auto-save wiring ── */

  const enableAutoSave = () => {
    State.on((event) => {
      // Skip events that don't represent a user change worth saving
      if (!event || ['loaded', 'cleared', 'saved'].includes(event)) return;
      debouncedSave();
    });
  };

  const updateCanvasMeta = async (canvasId, fields) => {
    if (!State.user || !window.SupabaseClient) return;
    try {
      const { error } = await SupabaseClient
        .from('canvases')
        .update(fields)
        .eq('id', canvasId)
        .eq('user_id', State.user.id);
      if (error) { showToast('Failed to update canvas', 'error'); return; }
      Sidebar.refresh();
    } catch (e) {
      showToast('Failed to update canvas', 'error');
    }
  };

  return {
    loadCanvas,
    saveCanvas,
    loadMostRecentCanvas,
    listCanvases,
    createCanvas,
    deleteCanvas,
    duplicateCanvas,
    updateCanvasMeta,
    saveSnapshot,
    listSnapshots,
    restoreSnapshot,
    enableAutoSave,
    debouncedSave,
  };
})();
