/* ============================================
   Connection — Rendering bezier curves in SVG
   ============================================ */

const ConnectionRenderer = (() => {
  let selectedConnectionId = null;

  /**
   * Render all connections
   */
  function renderAll() {
    const svg = Canvas.connectionsLayer;
    // Remove existing connections (keep defs and preview)
    svg.querySelectorAll('.connection-group').forEach(g => g.remove());

    const connections = State.getConnections();

    // Ensure arrow marker exists
    ensureArrowMarker(svg);

    connections.forEach(conn => renderConnection(conn, svg));
  }

  /**
   * Render a single connection
   */
  function renderConnection(conn, svg) {
    const sourceNode = State.getNodeById(conn.sourceId);
    const targetNode = State.getNodeById(conn.targetId);
    if (!sourceNode || !targetNode) return;

    // Get absolute positions
    const sourceAbsPos = State.getAbsolutePosition(conn.sourceId);
    const targetAbsPos = State.getAbsolutePosition(conn.targetId);

    const sourcePortPos = getPortPosition(
      { ...sourceNode, x: sourceAbsPos.x, y: sourceAbsPos.y },
      conn.sourcePort
    );
    const targetPortPos = getPortPosition(
      { ...targetNode, x: targetAbsPos.x, y: targetAbsPos.y },
      conn.targetPort
    );

    const pathData = generateBezierPath(
      sourcePortPos.x, sourcePortPos.y,
      targetPortPos.x, targetPortPos.y,
      conn.sourcePort, conn.targetPort
    );

    // Create group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('connection-group');
    group.dataset.id = conn.id;

    // Hit area (invisible wider path for clicking)
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.classList.add('connection-hit-area');
    hitArea.setAttribute('d', pathData);
    group.appendChild(hitArea);

    // Main path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection-path');
    if (selectedConnectionId === conn.id) path.classList.add('selected');
    path.setAttribute('d', pathData);
    path.setAttribute('marker-end', 'url(#arrow-marker)');
    path.style.stroke = sourceNode.color || 'var(--accent)';
    group.appendChild(path);

    // Animated flow dots
    if (conn.animated) {
      const flow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flow.classList.add('connection-flow');
      flow.setAttribute('d', pathData);
      flow.style.stroke = sourceNode.color || 'rgba(255,255,255,0.3)';
      group.appendChild(flow);
    }

    // Label (if any)
    if (conn.label) {
      const midX = (sourcePortPos.x + targetPortPos.x) / 2;
      const midY = (sourcePortPos.y + targetPortPos.y) / 2;

      const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelGroup.classList.add('connection-label-group');

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.classList.add('connection-label-text');
      textEl.setAttribute('x', midX);
      textEl.setAttribute('y', midY);
      textEl.textContent = conn.label;
      
      // Measure text for background
      labelGroup.appendChild(textEl);

      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.classList.add('connection-label-bg');
      // We'll position it after measuring text
      bgRect.setAttribute('x', midX - 30);
      bgRect.setAttribute('y', midY - 10);
      bgRect.setAttribute('width', 60);
      bgRect.setAttribute('height', 20);

      labelGroup.insertBefore(bgRect, textEl);
      group.appendChild(labelGroup);
    }

    // Event listeners
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      selectConnection(conn.id);
    });

    group.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      editConnectionLabel(conn);
    });

    svg.appendChild(group);
  }

  /**
   * Ensure SVG defs has arrow marker
   */
  function ensureArrowMarker(svg) {
    if (svg.querySelector('#arrow-marker')) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow-marker" viewBox="0 0 10 10" refX="10" refY="5"
              markerWidth="8" markerHeight="8" orient="auto-start-reverse"
              markerUnits="strokeWidth">
        <path d="M 0 0 L 10 5 L 0 10 z" class="connection-arrow" fill="var(--accent)" />
      </marker>
    `;
    svg.insertBefore(defs, svg.firstChild);
  }

  /**
   * Select a connection
   */
  function selectConnection(id) {
    selectedConnectionId = id;
    Selection.clearSelection();
    renderAll();
  }

  /**
   * Deselect all connections
   */
  function deselectAll() {
    selectedConnectionId = null;
  }

  /**
   * Get selected connection ID
   */
  function getSelectedConnection() {
    return selectedConnectionId;
  }

  /**
   * Edit connection label via prompt
   */
  function editConnectionLabel(conn) {
    const newLabel = prompt('Connection label:', conn.label || '');
    if (newLabel !== null) {
      State.updateConnection(conn.id, { label: newLabel });
      renderAll();
    }
  }

  /**
   * Delete selected connection
   */
  function deleteSelected() {
    if (selectedConnectionId) {
      State.deleteConnection(selectedConnectionId);
      selectedConnectionId = null;
      renderAll();
      NodeRenderer.renderAll();
    }
  }

  return {
    renderAll,
    renderConnection,
    selectConnection,
    deselectAll,
    getSelectedConnection,
    deleteSelected,
  };
})();
