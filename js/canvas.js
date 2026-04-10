/* ============================================
   Canvas — Pan, Zoom, Grid
   ============================================ */

const Canvas = (() => {
  // Canvas state
  let offsetX = 0;
  let offsetY = 0;
  let zoom = 1;

  // DOM references
  let container = null;
  let nodesLayer = null;
  let connectionsLayer = null;
  let gridCanvas = null;
  let gridCtx = null;
  let zoomIndicator = null;
  let coordsDisplay = null;

  // Pan state
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panStartOffsetX = 0;
  let panStartOffsetY = 0;
  let spaceHeld = false;

  // Zoom limits
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 3;

  // Zoom indicator timeout
  let zoomHideTimeout = null;

  /**
   * Initialize the canvas system
   */
  function init() {
    container = document.getElementById('canvas-container');
    nodesLayer = document.getElementById('nodes-layer');
    connectionsLayer = document.getElementById('connections-layer');
    gridCanvas = document.getElementById('canvas-grid');
    zoomIndicator = document.getElementById('zoom-indicator');
    coordsDisplay = document.getElementById('coords-display');

    // Set up grid canvas
    gridCtx = gridCanvas.getContext('2d');
    resizeGrid();

    // Event listeners
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Touch support
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    // Resize handler
    window.addEventListener('resize', debounce(resizeGrid, 100));

    // Space key for pan
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Initial render
    drawGrid();
    updateTransform();
  }

  /**
   * Resize the grid canvas to match container
   */
  function resizeGrid() {
    if (!gridCanvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    gridCanvas.width = container.clientWidth * dpr;
    gridCanvas.height = container.clientHeight * dpr;
    gridCanvas.style.width = container.clientWidth + 'px';
    gridCanvas.style.height = container.clientHeight + 'px';
    gridCtx.scale(dpr, dpr);
    drawGrid();
  }

  /**
   * Draw the dot grid
   */
  function drawGrid() {
    if (!gridCtx || !gridCanvas) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    gridCtx.clearRect(0, 0, gridCanvas.width / dpr, gridCanvas.height / dpr);

    const gridSize = 20 * zoom;
    if (gridSize < 5) return; // Too zoomed out to draw

    const startX = (offsetX % gridSize);
    const startY = (offsetY % gridSize);

    const majorEvery = 5; // Every 5th dot is major
    const baseGridSize = 20;

    // Draw dots
    for (let x = startX; x < w; x += gridSize) {
      for (let y = startY; y < h; y += gridSize) {
        // Determine if this is a major grid point
        const canvasX = (x - offsetX) / zoom;
        const canvasY = (y - offsetY) / zoom;
        const gridCol = Math.round(canvasX / baseGridSize);
        const gridRow = Math.round(canvasY / baseGridSize);
        const isMajor = gridCol % majorEvery === 0 && gridRow % majorEvery === 0;

        const dotSize = isMajor ? 1.5 : 0.8;
        const alpha = isMajor ? 0.12 : 0.05;

        gridCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        gridCtx.beginPath();
        gridCtx.arc(x, y, dotSize, 0, Math.PI * 2);
        gridCtx.fill();
      }
    }
  }

  /**
   * Update the CSS transform for the nodes layer and SVG viewBox
   */
  function updateTransform() {
    if (nodesLayer) {
      nodesLayer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    }
    if (connectionsLayer) {
      // SVG uses viewBox for transform
      const w = container.clientWidth;
      const h = container.clientHeight;
      const vbX = -offsetX / zoom;
      const vbY = -offsetY / zoom;
      const vbW = w / zoom;
      const vbH = h / zoom;
      connectionsLayer.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    }
    drawGrid();
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  function screenToCanvas(screenX, screenY) {
    const rect = container.getBoundingClientRect();
    return {
      x: (screenX - rect.left - offsetX) / zoom,
      y: (screenY - rect.top - offsetY) / zoom,
    };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  function canvasToScreen(canvasX, canvasY) {
    const rect = container.getBoundingClientRect();
    return {
      x: canvasX * zoom + offsetX + rect.left,
      y: canvasY * zoom + offsetY + rect.top,
    };
  }

  /* ── Mouse Handlers ── */

  function onMouseDown(e) {
    // Middle click or Space+left click = pan
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartOffsetX = offsetX;
      panStartOffsetY = offsetY;
      container.classList.add('panning');
      e.preventDefault();
      return;
    }
  }

  function onMouseMove(e) {
    // Update coords display
    if (coordsDisplay) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      coordsDisplay.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;
    }

    if (isPanning) {
      offsetX = panStartOffsetX + (e.clientX - panStartX);
      offsetY = panStartOffsetY + (e.clientY - panStartY);
      updateTransform();
      return;
    }
  }

  function onMouseUp(e) {
    if (isPanning) {
      isPanning = false;
      container.classList.remove('panning');
    }
  }

  /* ── Wheel / Zoom ── */

  function onWheel(e) {
    e.preventDefault();

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom factor
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clamp(zoom * delta, MIN_ZOOM, MAX_ZOOM);

    if (newZoom === zoom) return;

    // Zoom towards mouse position
    const scale = newZoom / zoom;
    offsetX = mouseX - (mouseX - offsetX) * scale;
    offsetY = mouseY - (mouseY - offsetY) * scale;
    zoom = newZoom;

    updateTransform();
    showZoomIndicator();
  }

  /**
   * Show zoom level briefly
   */
  function showZoomIndicator() {
    if (!zoomIndicator) return;
    zoomIndicator.textContent = `${Math.round(zoom * 100)}%`;
    zoomIndicator.classList.add('visible');

    clearTimeout(zoomHideTimeout);
    zoomHideTimeout = setTimeout(() => {
      zoomIndicator.classList.remove('visible');
    }, 1500);
  }

  /* ── Touch Handlers ── */

  let lastTouchDist = null;
  let lastTouchCenter = null;

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastTouchDist = distance(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
      lastTouchCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
      panStartOffsetX = offsetX;
      panStartOffsetY = offsetY;
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2 && lastTouchDist !== null) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = distance(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
      const center = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };

      const scale = newDist / lastTouchDist;
      const newZoom = clamp(zoom * scale, MIN_ZOOM, MAX_ZOOM);

      const rect = container.getBoundingClientRect();
      const mouseX = center.x - rect.left;
      const mouseY = center.y - rect.top;

      const zoomScale = newZoom / zoom;
      offsetX = mouseX - (mouseX - offsetX) * zoomScale;
      offsetY = mouseY - (mouseY - offsetY) * zoomScale;

      // Pan with center
      offsetX += center.x - lastTouchCenter.x;
      offsetY += center.y - lastTouchCenter.y;

      zoom = newZoom;
      lastTouchDist = newDist;
      lastTouchCenter = center;

      updateTransform();
      showZoomIndicator();
    } else if (e.touches.length === 1 && isPanning) {
      offsetX = panStartOffsetX + (e.touches[0].clientX - panStartX);
      offsetY = panStartOffsetY + (e.touches[0].clientY - panStartY);
      updateTransform();
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      lastTouchDist = null;
      lastTouchCenter = null;
    }
    if (e.touches.length === 0) {
      isPanning = false;
    }
  }

  /* ── Keyboard ── */

  function onKeyDown(e) {
    if (e.code === 'Space' && !e.repeat) {
      // Don't intercept if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      spaceHeld = true;
      container.style.cursor = 'grab';
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') {
      spaceHeld = false;
      container.style.cursor = '';
    }
  }

  /* ── Public Methods ── */

  /**
   * Fit view to show all content
   */
  function fitView(items, padding = 80) {
    if (!items || items.length === 0) {
      // Reset to origin
      offsetX = container.clientWidth / 2;
      offsetY = container.clientHeight / 2;
      zoom = 1;
      updateTransform();
      showZoomIndicator();
      return;
    }

    const bounds = getBoundingRect(items);
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scaleX = (cw - padding * 2) / bounds.width;
    const scaleY = (ch - padding * 2) / bounds.height;
    const newZoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM);

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    offsetX = cw / 2 - centerX * newZoom;
    offsetY = ch / 2 - centerY * newZoom;
    zoom = newZoom;

    updateTransform();
    showZoomIndicator();
  }

  /**
   * Set zoom to specific level
   */
  function setZoom(newZoom) {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const centerX = cw / 2;
    const centerY = ch / 2;

    const scale = newZoom / zoom;
    offsetX = centerX - (centerX - offsetX) * scale;
    offsetY = centerY - (centerY - offsetY) * scale;
    zoom = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);

    updateTransform();
    showZoomIndicator();
  }

  /**
   * Zoom in by 10%
   */
  function zoomIn() {
    setZoom(zoom * 1.15);
  }

  /**
   * Zoom out by 10%
   */
  function zoomOut() {
    setZoom(zoom / 1.15);
  }

  // Public API
  return {
    init,
    screenToCanvas,
    canvasToScreen,
    fitView,
    zoomIn,
    zoomOut,
    setZoom,
    updateTransform,
    get offsetX() { return offsetX; },
    get offsetY() { return offsetY; },
    get zoom() { return zoom; },
    get container() { return container; },
    get nodesLayer() { return nodesLayer; },
    get connectionsLayer() { return connectionsLayer; },
    set offsetX(v) { offsetX = v; },
    set offsetY(v) { offsetY = v; },
    set zoom(v) { zoom = v; },
    get isPanning() { return isPanning; },
    get spaceHeld() { return spaceHeld; },
  };
})();
