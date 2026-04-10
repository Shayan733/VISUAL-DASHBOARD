/* ============================================
   Toolbar — Button handlers
   ============================================ */

const Toolbar = (() => {

  function init() {
    // Add Node
    document.getElementById('btn-add-node').addEventListener('click', () => {
      const pos = Canvas.screenToCanvas(
        Canvas.container.clientWidth / 2,
        Canvas.container.clientHeight / 2
      );
      const node = State.addNode({
        x: pos.x - 90,
        y: pos.y - 30,
        label: 'New Node',
      });
      NodeRenderer.renderNode(node);
      Selection.select(node.id);
      Properties.show(node.id);
    });

    // Add Group
    document.getElementById('btn-add-group').addEventListener('click', () => {
      const pos = Canvas.screenToCanvas(
        Canvas.container.clientWidth / 2,
        Canvas.container.clientHeight / 2
      );
      const group = State.addGroup({
        x: pos.x - 200,
        y: pos.y - 150,
        label: 'New Group',
      });
      NodeRenderer.renderNode(group);
      Selection.select(group.id);
    });

    // Delete Selected
    document.getElementById('btn-delete').addEventListener('click', deleteSelected);

    // Zoom In
    document.getElementById('btn-zoom-in').addEventListener('click', () => Canvas.zoomIn());

    // Zoom Out
    document.getElementById('btn-zoom-out').addEventListener('click', () => Canvas.zoomOut());

    // Fit View
    document.getElementById('btn-fit-view').addEventListener('click', () => {
      Canvas.fitView(State.getNodes());
    });

    // Undo
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (History.undo()) {
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      }
    });

    // Redo
    document.getElementById('btn-redo').addEventListener('click', () => {
      if (History.redo()) {
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      }
    });

    // Save
    document.getElementById('btn-save').addEventListener('click', () => {
      State.save();
      showSaveIndicator();
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', () => {
      State.exportJSON();
    });

    // Import
    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          await State.importJSON(file);
          NodeRenderer.renderAll();
          ConnectionRenderer.renderAll();
          showSaveIndicator('Imported!');
        } catch (err) {
          alert('Failed to import: ' + err.message);
        }
      }
      e.target.value = '';
    });

    // Clear
    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('Clear entire canvas? This action can be undone with Ctrl+Z.')) {
        State.clearAll();
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      }
    });
  }

  /**
   * Delete selected nodes/connections
   */
  function deleteSelected() {
    const selectedConn = ConnectionRenderer.getSelectedConnection();
    if (selectedConn) {
      ConnectionRenderer.deleteSelected();
      return;
    }

    const selectedIds = Selection.getSelected();
    if (selectedIds.length > 0) {
      State.deleteNodes(selectedIds);
      Selection.clearSelection();
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    }
  }

  /**
   * Show save indicator
   */
  function showSaveIndicator(text = 'Saved ✓') {
    const existing = document.getElementById('save-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'save-indicator';
    indicator.textContent = text;
    document.body.appendChild(indicator);

    setTimeout(() => indicator.remove(), 1500);
  }

  return { init, deleteSelected, showSaveIndicator };
})();
