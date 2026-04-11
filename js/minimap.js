/* ============================================
   Minimap — Floating island showing all nodes
   ============================================ */

const Minimap = (() => {
  let minimapEl = null;
  let canvasEl = null;
  let ctx = null;
  let viewportEl = null;
  let labelEl = null;
  let isCollapsed = false;
  let isDragging = false;

  const PADDING = 20;

  function init() {
    minimapEl = document.getElementById('minimap');
    canvasEl = document.getElementById('minimap-canvas');
    viewportEl = document.getElementById('minimap-viewport');
    labelEl = document.getElementById('minimap-label');

    if (!canvasEl) return;

    ctx = canvasEl.getContext('2d');

    // Set canvas resolution
    resizeCanvas();

    // Toggle collapse
    const toggleBtn = document.getElementById('minimap-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        minimapEl.classList.toggle('collapsed', isCollapsed);
        if (!isCollapsed) render();
      });
    }

    // Click to navigate
    minimapEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Prevent canvas interactions
    minimapEl.addEventListener('wheel', (e) => e.stopPropagation());

    // Listen for state changes
    State.on(() => render());

    // Initial render
    render();

    // Update on interval for smooth viewport tracking
    setInterval(render, 200);
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  /**
   * Main render function — draws all nodes as tiny rectangles
   */
  function render() {
    if (!ctx || isCollapsed) return;

    const nodes = State.getNodes();
    const connections = State.getConnections();
    const mapW = canvasEl.getBoundingClientRect().width;
    const mapH = canvasEl.getBoundingClientRect().height;

    // Clear
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvasEl.width / dpr, canvasEl.height / dpr);

    // Handle empty state
    if (nodes.length === 0) {
      minimapEl.classList.add('empty');
      viewportEl.style.display = 'none';
      return;
    }
    minimapEl.classList.remove('empty');
    viewportEl.style.display = 'block';

    // Calculate bounds of all nodes
    const bounds = getWorldBounds(nodes);

    // Add padding
    const padded = {
      x: bounds.x - PADDING,
      y: bounds.y - PADDING,
      width: bounds.width + PADDING * 2,
      height: bounds.height + PADDING * 2,
    };

    // Calculate scale to fit everything in minimap
    const scaleX = mapW / padded.width;
    const scaleY = mapH / padded.height;
    const scale = Math.min(scaleX, scaleY) * 0.85; // Leave some breathing room

    // Center offset
    const offsetX = (mapW - padded.width * scale) / 2;
    const offsetY = (mapH - padded.height * scale) / 2;

    // Helper: world coords → minimap coords
    const toMinimap = (wx, wy) => ({
      x: (wx - padded.x) * scale + offsetX,
      y: (wy - padded.y) * scale + offsetY,
    });

    // Draw connections first (behind nodes)
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    connections.forEach(conn => {
      const sourceNode = State.getNodeById(conn.sourceId);
      const targetNode = State.getNodeById(conn.targetId);
      if (!sourceNode || !targetNode) return;

      const sAbsPos = State.getAbsolutePosition(conn.sourceId);
      const tAbsPos = State.getAbsolutePosition(conn.targetId);

      const sCenter = toMinimap(
        sAbsPos.x + (sourceNode.width || 180) / 2,
        sAbsPos.y + (sourceNode.height || 60) / 2
      );
      const tCenter = toMinimap(
        tAbsPos.x + (targetNode.width || 180) / 2,
        tAbsPos.y + (targetNode.height || 60) / 2
      );

      ctx.strokeStyle = sourceNode.color || '#818cf8';
      ctx.beginPath();
      ctx.moveTo(sCenter.x, sCenter.y);
      ctx.lineTo(tCenter.x, tCenter.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Draw nodes
    nodes.forEach(node => {
      const absPos = State.getAbsolutePosition(node.id);
      const w = node.width || 180;
      const h = node.height || 60;
      const pos = toMinimap(absPos.x, absPos.y);
      const mw = w * scale;
      const mh = h * scale;

      if (node.type === 'group') {
        // Groups: dashed outline
        ctx.strokeStyle = node.color || '#818cf8';
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(pos.x, pos.y, mw, mh);
        ctx.setLineDash([]);

        // Fill with very subtle color
        ctx.fillStyle = node.color || '#818cf8';
        ctx.globalAlpha = 0.06;
        ctx.fillRect(pos.x, pos.y, mw, mh);
        ctx.globalAlpha = 1;
      } else {
        // Regular nodes: filled rectangles
        ctx.fillStyle = node.color || '#818cf8';
        ctx.globalAlpha = 0.6;

        // Rounded mini-rect
        const r = Math.min(2, mw * 0.15);
        ctx.beginPath();
        ctx.moveTo(pos.x + r, pos.y);
        ctx.lineTo(pos.x + mw - r, pos.y);
        ctx.quadraticCurveTo(pos.x + mw, pos.y, pos.x + mw, pos.y + r);
        ctx.lineTo(pos.x + mw, pos.y + mh - r);
        ctx.quadraticCurveTo(pos.x + mw, pos.y + mh, pos.x + mw - r, pos.y + mh);
        ctx.lineTo(pos.x + r, pos.y + mh);
        ctx.quadraticCurveTo(pos.x, pos.y + mh, pos.x, pos.y + mh - r);
        ctx.lineTo(pos.x, pos.y + r);
        ctx.quadraticCurveTo(pos.x, pos.y, pos.x + r, pos.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Highlight selected nodes
        if (Selection.isSelected(node.id)) {
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    });

    // Draw viewport rectangle
    updateViewport(padded, scale, offsetX, offsetY, mapW, mapH);

    // Store transform for click-to-navigate
    minimapEl._transform = { padded, scale, offsetX, offsetY };
  }

  /**
   * Get world-space bounds of all nodes (including absolute positions)
   */
  function getWorldBounds(nodes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const absPos = State.getAbsolutePosition(node.id);
      const w = node.width || 180;
      const h = node.height || 60;

      minX = Math.min(minX, absPos.x);
      minY = Math.min(minY, absPos.y);
      maxX = Math.max(maxX, absPos.x + w);
      maxY = Math.max(maxY, absPos.y + h);
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Update the viewport indicator rectangle
   */
  function updateViewport(padded, scale, offsetX, offsetY, mapW, mapH) {
    if (!viewportEl) return;

    const container = Canvas.container;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Current view in world coordinates
    const viewLeft = -Canvas.offsetX / Canvas.zoom;
    const viewTop = -Canvas.offsetY / Canvas.zoom;
    const viewWidth = cw / Canvas.zoom;
    const viewHeight = ch / Canvas.zoom;

    // Convert to minimap coordinates
    const vx = (viewLeft - padded.x) * scale + offsetX;
    const vy = (viewTop - padded.y) * scale + offsetY;
    const vw = viewWidth * scale;
    const vh = viewHeight * scale;

    // Clamp to minimap bounds
    viewportEl.style.left = Math.max(0, vx) + 'px';
    viewportEl.style.top = Math.max(0, vy) + 'px';
    viewportEl.style.width = Math.min(vw, mapW) + 'px';
    viewportEl.style.height = Math.min(vh, mapH) + 'px';
  }

  /* ── Click/Drag to Navigate ── */

  function onMouseDown(e) {
    if (isCollapsed) return;
    if (e.target.id === 'minimap-toggle') return;

    isDragging = true;
    navigateTo(e);
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    navigateTo(e);
  }

  function onMouseUp() {
    isDragging = false;
  }

  /**
   * Navigate the main canvas to the clicked minimap position
   */
  function navigateTo(e) {
    const transform = minimapEl._transform;
    if (!transform) return;

    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Convert minimap coords → world coords
    const worldX = (mx - transform.offsetX) / transform.scale + transform.padded.x;
    const worldY = (my - transform.offsetY) / transform.scale + transform.padded.y;

    // Center the main canvas on this world position
    const container = Canvas.container;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    Canvas.offsetX = cw / 2 - worldX * Canvas.zoom;
    Canvas.offsetY = ch / 2 - worldY * Canvas.zoom;
    Canvas.updateTransform();

    render();
  }

  return { init, render };
})();
