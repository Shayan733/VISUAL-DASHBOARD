/* ============================================
   App — Entry point, bootstraps everything
   ============================================ */

const App = (() => {

  function init() {
    console.log('🧠 Visual Dashboard — Initializing...');

    // Initialize all modules
    Canvas.init();
    Selection.init();
    Drag.init();
    Toolbar.init();
    ContextMenu.init();
    Properties.init();
    Keyboard.init();
    Minimap.init();
    CommandPalette.init();
    WelcomeModal.init();

    // Listen for state changes
    State.on(onStateChange);

    // Check for read-only mode via URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('state=')) {
      const encoded = hash.replace('#state=', '');
      try {
        const state = JSON.parse(decodeURIComponent(atob(encoded)));
        State.loadFromJSON(state);
        State.readOnly = true;
        document.body.classList.add('read-only');
        console.log('📖 Read-only mode enabled');
        if (window.showToast) {
          showToast('Read-only mode. Export as PNG to download.', 'info');
        }
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      } catch (e) {
        console.error('Failed to decode state', e);
      }
    } else {
      // Normal startup: check localStorage
      const saved = localStorage.getItem('vd_canvas');
      const welcomed = localStorage.getItem('vd_welcomed');

      if (!saved && !welcomed) {
        WelcomeModal.show();
      } else if (saved) {
        State.loadFromJSON(JSON.parse(saved));
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
      }

      // Push initial state to history
      History.push();
    }

    // Double-click on canvas to create node
    Canvas.container.addEventListener('dblclick', onCanvasDblClick);

    // Open properties on node selection
    Canvas.nodesLayer.addEventListener('click', onNodeClick);

    console.log('🚀 Visual Dashboard ready!');
  }

  /**
   * Handle double-click on empty canvas — open command palette
   */
  function onCanvasDblClick(e) {
    // Don't open palette if clicked on existing node
    if (e.target.closest('.canvas-node')) return;

    const canvasPos = Canvas.screenToCanvas(e.clientX, e.clientY);
    CommandPalette.open(e.clientX, e.clientY, canvasPos.x, canvasPos.y);
  }

  /**
   * Handle click on a node to show properties
   */
  function onNodeClick(e) {
    const nodeEl = e.target.closest('.canvas-node');
    if (nodeEl) {
      const nodeId = nodeEl.dataset.id;
      // Show properties panel for clicked node
      Properties.show(nodeId);
    }
  }

  /**
   * Handle state change events
   */
  function onStateChange(event, data) {
    switch (event) {
      case 'loaded':
      case 'cleared':
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
        break;

      case 'node-deleted':
      case 'nodes-deleted':
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
        break;

      case 'saved':
        // Handled by toolbar
        break;
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
