/* ============================================
   Selection — Click, shift-click, box select
   ============================================ */

const Selection = (() => {
  let selectedIds = new Set();
  let selectionBox = null;
  let boxStartX = 0;
  let boxStartY = 0;
  let isBoxSelecting = false;

  /**
   * Initialize selection system
   */
  function init() {
    selectionBox = document.getElementById('selection-box');
  }

  /**
   * Select a single node (clear others unless shift held)
   */
  function select(id, additive = false) {
    if (State.readOnly) return; // Prevent selection in read-only mode

    if (!additive) {
      clearSelection();
    }

    selectedIds.add(id);
    const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('selected');
  }

  /**
   * Deselect a single node
   */
  function deselect(id) {
    selectedIds.delete(id);
    const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.remove('selected');
  }

  /**
   * Toggle selection
   */
  function toggle(id) {
    if (selectedIds.has(id)) {
      deselect(id);
    } else {
      selectedIds.add(id);
      const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.add('selected');
    }
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    selectedIds.forEach(id => {
      const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.remove('selected');
    });
    selectedIds.clear();
  }

  /**
   * Select all nodes
   */
  function selectAll() {
    State.getNodes().forEach(n => {
      selectedIds.add(n.id);
      const el = Canvas.nodesLayer.querySelector(`[data-id="${n.id}"]`);
      if (el) el.classList.add('selected');
    });
  }

  /**
   * Get selected IDs
   */
  function getSelected() {
    return Array.from(selectedIds);
  }

  /**
   * Check if a node is selected
   */
  function isSelected(id) {
    return selectedIds.has(id);
  }

  /**
   * Check if anything is selected
   */
  function hasSelection() {
    return selectedIds.size > 0;
  }

  /**
   * Start box selection
   */
  function startBoxSelect(screenX, screenY) {
    const canvasPos = Canvas.screenToCanvas(screenX, screenY);
    boxStartX = screenX;
    boxStartY = screenY;
    isBoxSelecting = true;

    selectionBox.style.display = 'block';
    selectionBox.style.left = screenX + 'px';
    selectionBox.style.top = screenY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
  }

  /**
   * Update box selection
   */
  function updateBoxSelect(screenX, screenY) {
    if (!isBoxSelecting) return;

    const x = Math.min(boxStartX, screenX);
    const y = Math.min(boxStartY, screenY);
    const w = Math.abs(screenX - boxStartX);
    const h = Math.abs(screenY - boxStartY);

    selectionBox.style.left = x + 'px';
    selectionBox.style.top = y + 'px';
    selectionBox.style.width = w + 'px';
    selectionBox.style.height = h + 'px';
  }

  /**
   * Finish box selection
   */
  function finishBoxSelect(screenX, screenY) {
    if (!isBoxSelecting) return;
    isBoxSelecting = false;
    selectionBox.style.display = 'none';

    // Convert box corners to canvas coordinates
    const topLeft = Canvas.screenToCanvas(
      Math.min(boxStartX, screenX),
      Math.min(boxStartY, screenY)
    );
    const bottomRight = Canvas.screenToCanvas(
      Math.max(boxStartX, screenX),
      Math.max(boxStartY, screenY)
    );

    const selectRect = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };

    // Skip if tiny box (was just a click)
    if (selectRect.width < 5 && selectRect.height < 5) return;

    // Find nodes inside the box
    clearSelection();
    State.getNodes().forEach(node => {
      const absPos = State.getAbsolutePosition(node.id);
      const nodeRect = {
        x: absPos.x,
        y: absPos.y,
        width: node.width || 180,
        height: node.height || 60,
      };

      if (rectsOverlap(selectRect, nodeRect)) {
        select(node.id, true);
      }
    });
  }

  /**
   * Cancel box selection
   */
  function cancelBoxSelect() {
    isBoxSelecting = false;
    if (selectionBox) selectionBox.style.display = 'none';
  }

  return {
    init,
    select,
    deselect,
    toggle,
    clearSelection,
    selectAll,
    getSelected,
    isSelected,
    hasSelection,
    startBoxSelect,
    updateBoxSelect,
    finishBoxSelect,
    cancelBoxSelect,
    get isBoxSelecting() { return isBoxSelecting; },
  };
})();
