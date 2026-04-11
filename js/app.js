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

    // Listen for state changes
    State.on(onStateChange);

    // Try to load saved state
    const loaded = State.load();
    if (loaded) {
      console.log('✅ Restored saved state');
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    } else {
      console.log('📋 Fresh canvas — starting empty');
      // Push initial empty state to history
      History.push();
      // Center the view
      Canvas.fitView([]);
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
