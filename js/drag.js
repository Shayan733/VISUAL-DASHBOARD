/* ============================================
   Drag — Unified drag handler
   ============================================ */

const Drag = (() => {
  let isDragging = false;
  let dragTarget = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragNodeStartPositions = [];
  let hasMoved = false;

  // Connection creation drag
  let isConnecting = false;
  let connectSourceId = null;
  let connectSourcePort = null;
  let connectPreviewPath = null;

  // Resize drag
  let isResizing = false;
  let resizeTarget = null;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;

  /**
   * Initialize drag system
   */
  function init() {
    const container = Canvas.container;

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    if (Canvas.spaceHeld) return; // Space = pan, not drag
    if (Canvas.isPanning) return; // Canvas is handling pan

    const target = e.target;

    // ── Port drag (create connection) ──
    if (target.classList.contains('node-port')) {
      e.stopPropagation();
      e.preventDefault();
      startConnectionDrag(target, e);
      return;
    }

    // ── Resize handle ──
    if (target.classList.contains('node-resize-handle')) {
      e.stopPropagation();
      e.preventDefault();
      startResize(target, e);
      return;
    }

    // ── Node drag ──
    const nodeEl = target.closest('.canvas-node');
    if (nodeEl) {
      e.stopPropagation();

      const nodeId = nodeEl.dataset.id;

      // If clicking on an editable element, don't start drag
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' ||
          target.getAttribute('contenteditable') === 'true') {
        return;
      }

      // Selection logic
      if (e.shiftKey) {
        Selection.toggle(nodeId);
      } else if (!Selection.isSelected(nodeId)) {
        Selection.select(nodeId);
      }

      startNodeDrag(nodeEl, e);
      return;
    }

    // ── Canvas click ──
    const isEmptyCanvas = target === Canvas.container || target === Canvas.nodesLayer || 
        target.id === 'canvas-grid' || target.parentElement === Canvas.connectionsLayer;
    if (isEmptyCanvas) {
      Selection.clearSelection();
      ConnectionRenderer.deselectAll();

      // Shift+drag or Ctrl/Cmd+drag = box select
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const rect = Canvas.container.getBoundingClientRect();
        Selection.startBoxSelect(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  }

  function onMouseMove(e) {
    if (isConnecting) {
      updateConnectionDrag(e);
      return;
    }

    if (isResizing) {
      updateResize(e);
      return;
    }

    if (isDragging) {
      updateNodeDrag(e);
      return;
    }

    if (Selection.isBoxSelecting) {
      const rect = Canvas.container.getBoundingClientRect();
      Selection.updateBoxSelect(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  function onMouseUp(e) {
    if (isConnecting) {
      finishConnectionDrag(e);
      return;
    }

    if (isResizing) {
      finishResize(e);
      return;
    }

    if (isDragging) {
      finishNodeDrag(e);
      return;
    }

    if (Selection.isBoxSelecting) {
      const rect = Canvas.container.getBoundingClientRect();
      Selection.finishBoxSelect(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  /* ── Node Dragging ── */

  function startNodeDrag(el, e) {
    isDragging = true;
    hasMoved = false;
    dragTarget = el;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // Store start positions of all selected nodes
    const selectedIds = Selection.getSelected();
    dragNodeStartPositions = selectedIds.map(id => {
      const node = State.getNodeById(id);
      return { id, x: node.x, y: node.y };
    });
  }

  function updateNodeDrag(e) {
    const dx = (e.clientX - dragStartX) / Canvas.zoom;
    const dy = (e.clientY - dragStartY) / Canvas.zoom;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasMoved = true;
    }

    if (!hasMoved) return;

    // Move all selected nodes
    dragNodeStartPositions.forEach(({ id, x, y }) => {
      const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.add('dragging');

      State.updateNode(id, { x: x + dx, y: y + dy });

      // Use absolute position for DOM placement
      const absPos = State.getAbsolutePosition(id);
      if (el) {
        el.style.left = absPos.x + 'px';
        el.style.top = absPos.y + 'px';
      }

      // If this is a group, also update all child node DOM positions
      const node = State.getNodeById(id);
      if (node && node.type === 'group') {
        const children = State.getChildren(id);
        children.forEach(child => {
          const childEl = Canvas.nodesLayer.querySelector(`[data-id="${child.id}"]`);
          if (childEl) {
            const childAbsPos = State.getAbsolutePosition(child.id);
            childEl.style.left = childAbsPos.x + 'px';
            childEl.style.top = childAbsPos.y + 'px';
          }
        });
      }
    });

    // Update connections for moved nodes
    ConnectionRenderer.renderAll();

    // Check for group drop targets
    checkGroupDropTargets(e);
  }

  function finishNodeDrag(e) {
    isDragging = false;

    // Remove dragging class
    dragNodeStartPositions.forEach(({ id }) => {
      const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.remove('dragging');
    });

    // Handle group reparenting
    if (hasMoved) {
      const dropGroup = findDropTargetGroup(e);
      const selectedIds = Selection.getSelected();

      selectedIds.forEach(id => {
        const node = State.getNodeById(id);
        if (!node) return;

        // Don't put group inside itself or its children
        if (dropGroup && dropGroup.id !== id && node.type !== 'group') {
          // Convert to relative position within group
          const absPos = State.getAbsolutePosition(id);
          if (node.parentId !== dropGroup.id) {
            node.x = absPos.x - dropGroup.x;
            node.y = absPos.y - dropGroup.y;
            State.updateNode(id, { parentId: dropGroup.id, x: node.x, y: node.y });
          }
        } else if (!dropGroup && node.parentId) {
          // Dragged out of group — convert to absolute position
          const absPos = State.getAbsolutePosition(id);
          State.updateNode(id, { parentId: null, x: absPos.x, y: absPos.y });
        }
      });

      History.push();
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    }

    // Clear drop target highlights
    document.querySelectorAll('.group-node.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });

    dragNodeStartPositions = [];
    dragTarget = null;
  }

  function checkGroupDropTargets(e) {
    // Clear previous highlights
    document.querySelectorAll('.group-node.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });

    const dropGroup = findDropTargetGroup(e);
    if (dropGroup) {
      const el = Canvas.nodesLayer.querySelector(`[data-id="${dropGroup.id}"]`);
      if (el) el.classList.add('drop-target');
    }
  }

  function findDropTargetGroup(e) {
    const canvasPos = Canvas.screenToCanvas(e.clientX, e.clientY);
    const selectedIds = Selection.getSelected();
    const groups = State.getNodes().filter(n => n.type === 'group');

    for (const group of groups) {
      // Don't drop onto a selected group
      if (selectedIds.includes(group.id)) continue;

      if (pointInRect(canvasPos.x, canvasPos.y, group.x, group.y, group.width, group.height)) {
        return group;
      }
    }

    return null;
  }

  /* ── Connection Dragging ── */

  function startConnectionDrag(portEl, e) {
    isConnecting = true;
    const nodeEl = portEl.closest('.canvas-node');
    connectSourceId = nodeEl.dataset.id;
    connectSourcePort = portEl.dataset.port;

    Canvas.container.classList.add('connecting');

    // Show all ports on all nodes
    document.querySelectorAll('.canvas-node').forEach(el => {
      el.classList.add('connecting');
    });

    // Create preview path
    const svg = Canvas.connectionsLayer;
    connectPreviewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connectPreviewPath.classList.add('connection-preview-path');
    svg.appendChild(connectPreviewPath);
  }

  function updateConnectionDrag(e) {
    if (!connectPreviewPath) return;

    const sourceNode = State.getNodeById(connectSourceId);
    if (!sourceNode) return;

    const absPos = State.getAbsolutePosition(connectSourceId);
    const sourcePortPos = getPortPosition(
      { ...sourceNode, x: absPos.x, y: absPos.y },
      connectSourcePort
    );
    const canvasPos = Canvas.screenToCanvas(e.clientX, e.clientY);

    const path = generateBezierPath(
      sourcePortPos.x, sourcePortPos.y,
      canvasPos.x, canvasPos.y,
      connectSourcePort,
      getOppositePort(connectSourcePort)
    );

    connectPreviewPath.setAttribute('d', path);
  }

  function finishConnectionDrag(e) {
    isConnecting = false;
    Canvas.container.classList.remove('connecting');

    document.querySelectorAll('.canvas-node').forEach(el => {
      el.classList.remove('connecting');
    });

    // Remove preview
    if (connectPreviewPath) {
      connectPreviewPath.remove();
      connectPreviewPath = null;
    }

    // Check if we dropped on a port
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.classList.contains('node-port')) {
      const targetNodeEl = target.closest('.canvas-node');
      const targetId = targetNodeEl.dataset.id;
      const targetPort = target.dataset.port;

      if (targetId !== connectSourceId) {
        State.addConnection({
          sourceId: connectSourceId,
          targetId: targetId,
          sourcePort: connectSourcePort,
          targetPort: targetPort,
        });
        ConnectionRenderer.renderAll();
        NodeRenderer.renderAll(); // Update port states
      }
    }

    connectSourceId = null;
    connectSourcePort = null;
  }

  function getOppositePort(port) {
    const map = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    return map[port] || 'left';
  }

  /* ── Resize ── */

  function startResize(handle, e) {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    
    const nodeEl = handle.closest('.canvas-node');
    resizeTarget = nodeEl.dataset.id;
    const node = State.getNodeById(resizeTarget);
    resizeStartWidth = node.width;
    resizeStartHeight = node.height || 60;
  }

  function updateResize(e) {
    const dx = (e.clientX - resizeStartX) / Canvas.zoom;
    const dy = (e.clientY - resizeStartY) / Canvas.zoom;
    const node = State.getNodeById(resizeTarget);
    if (!node) return;

    const minW = node.type === 'group' ? 300 : 160;
    const minH = node.type === 'group' ? 200 : 52;

    const newWidth = Math.max(minW, resizeStartWidth + dx);
    const newHeight = Math.max(minH, resizeStartHeight + dy);

    State.updateNode(resizeTarget, { width: newWidth, height: newHeight });

    const el = Canvas.nodesLayer.querySelector(`[data-id="${resizeTarget}"]`);
    if (el) {
      el.style.width = newWidth + 'px';
      el.style.height = newHeight + 'px';
    }

    ConnectionRenderer.renderAll();
  }

  function finishResize(e) {
    isResizing = false;
    History.push();
    resizeTarget = null;
  }

  return {
    init,
    get isDragging() { return isDragging; },
    get isConnecting() { return isConnecting; },
    get isResizing() { return isResizing; },
  };
})();
