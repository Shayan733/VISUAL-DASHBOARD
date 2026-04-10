/* ============================================
   Keyboard — Global shortcut handler
   ============================================ */

const Keyboard = (() => {

  function init() {
    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    // Don't handle shortcuts when typing in inputs
    const tag = e.target.tagName;
    const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || 
                      e.target.getAttribute('contenteditable') === 'true';

    const mod = e.metaKey || e.ctrlKey;

    // ── Delete / Backspace ──
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
      e.preventDefault();
      Toolbar.deleteSelected();
      return;
    }

    // ── Ctrl/Cmd + Z — Undo ──
    if (mod && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (History.undo()) {
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      }
      return;
    }

    // ── Ctrl/Cmd + Shift + Z — Redo ──
    if (mod && e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (History.redo()) {
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      }
      return;
    }

    // ── Ctrl/Cmd + S — Save ──
    if (mod && e.key === 's') {
      e.preventDefault();
      State.save();
      Toolbar.showSaveIndicator();
      return;
    }

    // ── Ctrl/Cmd + D — Duplicate ──
    if (mod && e.key === 'd' && !isEditing) {
      e.preventDefault();
      const selectedIds = Selection.getSelected();
      if (selectedIds.length > 0) {
        const newNodes = State.duplicateNodes(selectedIds);
        Selection.clearSelection();
        newNodes.forEach(n => {
          NodeRenderer.renderNode(n);
          Selection.select(n.id, true);
        });
        ConnectionRenderer.renderAll();
      }
      return;
    }

    // ── Ctrl/Cmd + A — Select All ──
    if (mod && e.key === 'a' && !isEditing) {
      e.preventDefault();
      Selection.selectAll();
      return;
    }

    // ── Escape — Deselect / Close ──
    if (e.key === 'Escape') {
      Selection.clearSelection();
      ConnectionRenderer.deselectAll();
      ConnectionRenderer.renderAll();
      ContextMenu.close();
      Properties.hide();
      return;
    }
  }

  return { init };
})();
