/* ============================================
   Properties Panel — Edit selected node
   ============================================ */

const Properties = (() => {
  let panelEl = null;
  let currentNodeId = null;
  let canvasClickHandlerBound = false;

  function init() {
    panelEl = document.getElementById('properties-panel');

    // Click outside closes the panel (backdrop-free).
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer && !canvasClickHandlerBound) {
      canvasClickHandlerBound = true;
      canvasContainer.addEventListener('click', (e) => {
        if (!panelEl) return;
        if (e.target.closest('.canvas-node')) return;
        if (e.target.closest('#properties-panel')) return;
        hide();
      });
    }
  }

  /**
   * Show properties for a node
   */
  function show(nodeId) {
    const node = State.getNodeById(nodeId);
    if (!node) return;

    currentNodeId = nodeId;

    const isCustomColor = !NODE_COLORS.some(c => c.value === node.color);

    const colorSwatches = NODE_COLORS.map(c =>
      `<div class="props-color-swatch ${c.value === node.color ? 'active' : ''}"
            style="background:${c.value}" data-color="${c.value}"
            title="${c.name}"></div>`
    ).join('');

    const statusOptions = STATUSES.map(s =>
      `<div class="props-status-option ${s.key === node.status ? 'active' : ''}" data-status="${s.key || ''}">
        <span class="props-status-dot" style="background:${s.color}"></span>
        ${s.label}
      </div>`
    ).join('');

    panelEl.innerHTML = `
      <div class="props-header">
        <h3>${node.type === 'group' ? 'Group' : 'Node'} Properties</h3>
        <button class="props-close-btn" id="props-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="props-body">
        <div class="props-field">
          <label>Label</label>
          <input type="text" id="props-label" value="${escapeAttr(node.label)}" placeholder="Node label">
        </div>
        <div class="props-field">
          <label>Description</label>
          <textarea id="props-description" placeholder="Add notes or description...">${escapeAttr(node.description || '')}</textarea>
        </div>
        <div class="props-field">
          <label>Color</label>
          <div class="props-color-grid" id="props-colors">
            ${colorSwatches}
            <label class="props-custom-swatch ${isCustomColor ? 'active' : ''}" title="Custom colour">
              <span class="props-custom-swatch-preview" id="props-custom-preview" style="background:${node.color}"></span>
              <input type="color" id="props-color-wheel" value="${node.color}">
            </label>
          </div>
        </div>
        <div class="props-field">
          <label>Status</label>
          <div class="props-status-list" id="props-statuses">${statusOptions}</div>
        </div>
        <div class="props-field">
          <label>Owner</label>
          <input type="text" id="props-owner" value="${escapeAttr(node.owner || '')}" placeholder="@username">
        </div>
        <div class="props-field">
          <label>Due Date</label>
          <input type="date" id="props-due-date" value="${node.dueDate || ''}">
        </div>
        ${Attachments.buildSectionHTML()}
        <button class="props-delete-btn" id="props-delete">Delete ${node.type === 'group' ? 'Group' : 'Node'}</button>
      </div>
    `;

    panelEl.dataset.nodeId = nodeId;
    panelEl.classList.add('open');
    // Redraw connections after the 200ms slide-in transition completes.
    setTimeout(() => {
      if (typeof ConnectionRenderer !== 'undefined') {
        ConnectionRenderer.renderAll();
      }
    }, 210);
    bindEvents();
    Attachments.renderPanel(nodeId);
    Attachments.bindPanelEvents(nodeId);
  }

  /**
   * Hide properties panel
   */
  function hide() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    currentNodeId = null;
    setTimeout(() => {
      if (typeof ConnectionRenderer !== 'undefined') {
        ConnectionRenderer.renderAll();
      }
    }, 210);
  }

  /**
   * Bind input events
   */
  function bindEvents() {
    // Close
    document.getElementById('props-close').addEventListener('click', hide);

    // Label
    const labelInput = document.getElementById('props-label');
    labelInput.addEventListener('input', () => {
      if (currentNodeId) {
        State.updateNode(currentNodeId, { label: labelInput.value });
        const node = State.getNodeById(currentNodeId);
        if (node) NodeRenderer.renderNode(node);
      }
    });

    // Description
    const descInput = document.getElementById('props-description');
    descInput.addEventListener('input', () => {
      if (currentNodeId) {
        State.updateNode(currentNodeId, { description: descInput.value });
      }
    });

    // Preset swatches
    document.getElementById('props-colors').addEventListener('click', (e) => {
      const swatch = e.target.closest('.props-color-swatch');
      if (swatch && currentNodeId) {
        const color = swatch.dataset.color;
        State.updateNode(currentNodeId, { color });
        const node = State.getNodeById(currentNodeId);
        if (node) {
          NodeRenderer.renderNode(node);
          ConnectionRenderer.renderAll();
        }
        document.querySelectorAll('.props-color-swatch, .props-custom-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        document.getElementById('props-custom-preview').style.background = color;
        document.getElementById('props-color-wheel').value = color;
      }
    });

    // Custom colour wheel
    const colorWheel = document.getElementById('props-color-wheel');
    colorWheel.addEventListener('input', () => {
      if (!currentNodeId) return;
      const color = colorWheel.value;
      document.getElementById('props-custom-preview').style.background = color;
      State.updateNode(currentNodeId, { color });
      const node = State.getNodeById(currentNodeId);
      if (node) {
        NodeRenderer.renderNode(node);
        ConnectionRenderer.renderAll();
      }
      // Clear preset active, mark custom active
      document.querySelectorAll('.props-color-swatch').forEach(s => s.classList.remove('active'));
      document.querySelector('.props-custom-swatch').classList.add('active');
    });

    // Status
    document.getElementById('props-statuses').addEventListener('click', (e) => {
      const option = e.target.closest('.props-status-option');
      if (option && currentNodeId) {
        const status = option.dataset.status || null;
        State.updateNode(currentNodeId, { status });
        const node = State.getNodeById(currentNodeId);
        if (node) NodeRenderer.renderNode(node);
        // Update active state
        document.querySelectorAll('.props-status-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
      }
    });

    // Owner
    const ownerInput = document.getElementById('props-owner');
    ownerInput.addEventListener('input', () => {
      if (currentNodeId) {
        State.updateNode(currentNodeId, { owner: ownerInput.value });
      }
    });

    // Due Date
    const dueDateInput = document.getElementById('props-due-date');
    dueDateInput.addEventListener('input', () => {
      if (currentNodeId) {
        State.updateNode(currentNodeId, { dueDate: dueDateInput.value });
      }
    });

    // Delete
    document.getElementById('props-delete').addEventListener('click', () => {
      if (currentNodeId) {
        State.deleteNode(currentNodeId);
        Selection.clearSelection();
        NodeRenderer.renderAll();
        ConnectionRenderer.renderAll();
        hide();
      }
    });

    // Prevent canvas interactions when using panel
    panelEl.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init, show, hide, get currentNodeId() { return currentNodeId; } };
})();
