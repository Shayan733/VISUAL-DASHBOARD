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
    svg.querySelectorAll('.connection-group').forEach(g => g.remove());
    svg.querySelectorAll('.note-link-line').forEach(l => l.remove());

    ensureArrowMarker(svg);

    State.getConnections().forEach(conn => renderConnection(conn, svg));
    renderNoteLinkLines(svg);
  }

  function renderNoteLinkLines(svg) {
    // Draw a dashed anchor line from a sticky note to its linked regular node
    State.getNodes()
      .filter(n => n.type === 'sticky' && n.parentId)
      .forEach(note => {
        const parent = State.getNodeById(note.parentId);
        // Only draw line when linked to a regular node (not a group)
        if (!parent || parent.type !== 'node') return;

        const np  = State.getAbsolutePosition(note.id);
        const lp  = State.getAbsolutePosition(note.parentId);
        const x1  = np.x + (note.width || 180) / 2;
        const y1  = np.y + (note.height || 100) / 2;
        const x2  = lp.x + (parent.width || 200) / 2;
        const y2  = lp.y + (parent.height || 52) / 2;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('note-link-line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        svg.appendChild(line);
      });
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
    const connColor = sourceNode.color || 'var(--accent)';
    const markerId = ensureColoredArrowMarker(svg, connColor, conn.id);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection-path');
    if (selectedConnectionId === conn.id) path.classList.add('selected');
    path.setAttribute('d', pathData);
    path.setAttribute('marker-end', `url(#${markerId})`);
    path.style.stroke = connColor;
    group.appendChild(path);

    // Animated flow dots
    if (conn.animated) {
      const flow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flow.classList.add('connection-flow');
      flow.setAttribute('d', pathData);
      flow.style.stroke = sourceNode.color || 'rgba(255,255,255,0.3)';
      group.appendChild(flow);
    }

    // Append to SVG now so text measurement works below
    svg.appendChild(group);

    // Label (if any)
    if (conn.label) {
      const midX = (sourcePortPos.x + targetPortPos.x) / 2;
      const midY = (sourcePortPos.y + targetPortPos.y) / 2;

      const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelGroup.classList.add('connection-label-group');

      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.classList.add('connection-label-bg');
      bgRect.setAttribute('y', midY - 10);
      bgRect.setAttribute('height', 20);
      labelGroup.appendChild(bgRect);

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.classList.add('connection-label-text');
      textEl.setAttribute('x', midX);
      textEl.setAttribute('y', midY);
      textEl.textContent = conn.label;
      labelGroup.appendChild(textEl);

      group.appendChild(labelGroup);

      // Measure text now that it's in the live DOM, then size the background
      const pad = 8;
      const textWidth = textEl.getComputedTextLength();
      bgRect.setAttribute('x', midX - textWidth / 2 - pad);
      bgRect.setAttribute('width', textWidth + pad * 2);
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
  }

  /**
   * Ensure SVG has a <defs> block, clearing stale per-connection markers each render
   */
  function ensureArrowMarker(svg) {
    // Remove old defs so stale colored markers don't accumulate
    const oldDefs = svg.querySelector('defs');
    if (oldDefs) oldDefs.remove();
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  /**
   * Create a colored arrow marker for a specific connection and return its id.
   * Uses a sanitized color string as part of the id so colors are deduplicated.
   */
  function ensureColoredArrowMarker(svg, color, connId) {
    const defs = svg.querySelector('defs');
    const markerId = `arrow-${connId}`;
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto-start-reverse');
    marker.setAttribute('markerUnits', 'strokeWidth');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', color);
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    return markerId;
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
