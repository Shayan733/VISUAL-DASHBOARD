/* ============================================
   Toolbar — Floating toolbox with drag support
   ============================================ */

const Toolbar = (() => {

  const STORAGE_KEY = 'toolbox-pos';

  function init() {
    // ── Create buttons ──
    document.getElementById('btn-add-node').addEventListener('click', addNode);
    document.getElementById('btn-add-group').addEventListener('click', addGroup);
    document.getElementById('btn-add-sticky').addEventListener('click', addSticky);
    document.getElementById('btn-delete').addEventListener('click', deleteSelected);
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-zoom-in').addEventListener('click', () => Canvas.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => Canvas.zoomOut());
    document.getElementById('btn-fit-view').addEventListener('click', () => Canvas.fitView(State.getNodes()));
    document.getElementById('btn-save').addEventListener('click', save);
    document.getElementById('btn-export').addEventListener('click', () => State.exportJSON());
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('btn-export-png').addEventListener('click', exportPNG);
    document.getElementById('btn-share').addEventListener('click', shareCanvas);
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    document.getElementById('toolbox-close').addEventListener('click', hide);

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

    // ── Dragging ──
    initDrag();

    // ── Restore saved position ──
    restorePosition();
  }

  /* ── Actions ── */

  function addNode() {
    const pos = Canvas.screenToCanvas(
      Canvas.container.clientWidth / 2,
      Canvas.container.clientHeight / 2
    );
    const node = State.addNode({ x: pos.x - 90, y: pos.y - 30, label: 'New Node' });
    NodeRenderer.renderNode(node);
    Selection.select(node.id);
    Properties.show(node.id);
  }

  function addGroup() {
    const pos = Canvas.screenToCanvas(
      Canvas.container.clientWidth / 2,
      Canvas.container.clientHeight / 2
    );
    const group = State.addGroup({ x: pos.x - 200, y: pos.y - 150, label: 'New Group' });
    NodeRenderer.renderNode(group);
    Selection.select(group.id);
  }

  function addSticky() {
    const pos = Canvas.screenToCanvas(
      Canvas.container.clientWidth / 2,
      Canvas.container.clientHeight / 2
    );
    const sticky = State.addNode({
      type: 'sticky',
      x: pos.x - 90,
      y: pos.y - 50,
      width: 180,
      label: 'Note',
      description: '',
      color: '#fbbf24',
    });
    NodeRenderer.renderNode(sticky);
    Selection.select(sticky.id);
    setTimeout(() => {
      const el = Canvas.nodesLayer.querySelector(`[data-id="${sticky.id}"]`);
      if (el) el.querySelector('.sticky-text')?.focus();
    }, 60);
  }

  function undo() {
    if (History.undo()) {
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    }
  }

  function redo() {
    if (History.redo()) {
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    }
  }

  function save() {
    State.save();
    showSaveIndicator();
  }

  function clearCanvas() {
    if (confirm('Clear entire canvas? This action can be undone with Ctrl+Z.')) {
      State.clearAll();
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    }
  }

  async function exportPNG() {
    if (State.readOnly) {
      showSaveIndicator('Cannot export in read-only mode');
      return;
    }
    const canvas = document.querySelector('#canvas-container');
    if (!canvas) {
      showSaveIndicator('No canvas to export');
      return;
    }
    try {
      const image = await html2canvas(canvas, {
        backgroundColor: '#0c0c14',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      const link = document.createElement('a');
      link.href = image.toDataURL('image/png');
      link.download = `canvas-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      showSaveIndicator('Canvas exported as PNG');
    } catch (error) {
      showSaveIndicator('Export failed: ' + error.message);
    }
  }

  function shareCanvas() {
    if (State.readOnly) {
      showSaveIndicator('Cannot share in read-only mode');
      return;
    }
    const state = State.toJSON();
    const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
    const url = window.location.origin + window.location.pathname + `#state=${encoded}`;

    navigator.clipboard.writeText(url).then(() => {
      showSaveIndicator('Shareable link copied to clipboard');
    }).catch(() => {
      showSaveIndicator('Copy failed. URL: ' + url);
    });
  }

  /* ── Delete ── */
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

  /* ── Show / Hide ── */
  function hide() {
    const toolbox = document.getElementById('toolbox');
    toolbox.classList.add('hidden');
    localStorage.setItem('toolbox-visible', 'false');
  }

  function show() {
    const toolbox = document.getElementById('toolbox');
    toolbox.classList.remove('hidden');
    // Snap back to left-center default if no saved position
    const saved = getSavedPosition();
    if (!saved) {
      toolbox.style.left = '16px';
      toolbox.style.top = '';
      toolbox.style.transform = 'translateY(-50%)';
      // Apply after render so CSS centering kicks in
      requestAnimationFrame(() => {
        toolbox.style.top = '50%';
      });
    }
    localStorage.setItem('toolbox-visible', 'true');
  }

  function isVisible() {
    return !document.getElementById('toolbox').classList.contains('hidden');
  }

  /* ── Drag ── */
  function initDrag() {
    const toolbox = document.getElementById('toolbox');
    const handle  = document.getElementById('toolbox-drag-handle');

    let dragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    handle.addEventListener('mousedown', (e) => {
      // Don't start drag from the close button
      if (e.target.closest('.toolbox-close-btn')) return;
      e.preventDefault();

      dragging = true;
      const rect = toolbox.getBoundingClientRect();

      // Freeze current position absolutely so we can drag freely
      toolbox.style.left = rect.left + 'px';
      toolbox.style.top  = rect.top  + 'px';
      toolbox.style.transform = 'none';
      toolbox.classList.add('is-dragging');

      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop  = rect.top;
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(0, Math.min(window.innerWidth  - toolbox.offsetWidth,  startLeft + dx));
      const newTop  = Math.max(0, Math.min(window.innerHeight - toolbox.offsetHeight, startTop  + dy));

      toolbox.style.left = newLeft + 'px';
      toolbox.style.top  = newTop  + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      toolbox.classList.remove('is-dragging');

      // Save position
      savePosition(parseInt(toolbox.style.left), parseInt(toolbox.style.top));
    });
  }

  function savePosition(left, top) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
  }

  function getSavedPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function restorePosition() {
    const toolbox = document.getElementById('toolbox');

    // Restore visibility
    const visible = localStorage.getItem('toolbox-visible');
    if (visible === 'false') {
      toolbox.classList.add('hidden');
    }

    // Restore position
    const pos = getSavedPosition();
    if (pos) {
      toolbox.style.left = pos.left + 'px';
      toolbox.style.top  = pos.top  + 'px';
      toolbox.style.transform = 'none';
    }
  }

  /* ── Save indicator ── */
  function showSaveIndicator(text = 'Saved ✓') {
    const existing = document.getElementById('save-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'save-indicator';
    indicator.textContent = text;
    document.body.appendChild(indicator);

    setTimeout(() => indicator.remove(), 1500);
  }

  return { init, deleteSelected, showSaveIndicator, show, hide, isVisible };
})();
