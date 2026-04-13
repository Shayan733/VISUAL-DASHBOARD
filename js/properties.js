/* ============================================
   Properties Panel — Edit selected node
   ============================================ */

const Properties = (() => {
  let panelEl = null;
  let currentNodeId = null;

  function init() {
    panelEl = document.getElementById('properties-panel');

    // Fix: stop scroll inside properties panel from zooming the canvas
    panelEl.addEventListener('wheel', (e) => {
      e.stopPropagation();
    }, { passive: false });
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
        <div class="props-field">
          <label>Attachments</label>
          <div class="props-attachments-list" id="props-attachments-list">
            ${renderAttachmentItems(node.attachments)}
          </div>
          <button class="attach-btn" id="props-attach-btn">+ Attach file</button>
          <input type="file" id="props-file-input" multiple style="display:none">
        </div>
        <button class="props-delete-btn" id="props-delete">Delete ${node.type === 'group' ? 'Group' : 'Node'}</button>
      </div>
    `;

    panelEl.classList.add('visible');
    document.documentElement.style.setProperty('--props-w', '280px');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      ConnectionRenderer.renderAll();
    }, 260);
    bindEvents();
  }

  /**
   * Render attachment list items HTML
   */
  function renderAttachmentItems(attachments) {
    if (!attachments || attachments.length === 0) {
      return '<div class="props-no-attachments">No attachments yet</div>';
    }
    return attachments.map(att => {
      let preview = '';
      const type = att.type || '';
      if (type.startsWith('image/')) {
        preview = `<img src="${att.dataUrl}" alt="${escapeAttr(att.name)}" class="props-attachment-preview-img">`;
      } else if (type.startsWith('audio/')) {
        preview = `<audio controls src="${att.dataUrl}" class="props-attachment-media"></audio>`;
      } else if (type.startsWith('video/')) {
        preview = `<video controls src="${att.dataUrl}" class="props-attachment-media"></video>`;
      } else {
        preview = `<div class="props-attachment-file-icon">&#128196; ${escapeAttr(att.name)}</div>`;
      }
      return `
        <div class="props-attachment-item" data-att-id="${att.id}">
          ${preview}
          <div class="props-attachment-meta">
            <span class="props-attachment-name" title="${escapeAttr(att.name)}">${escapeAttr(att.name)}</span>
            <span class="props-attachment-size">${formatFileSize(att.size)}</span>
          </div>
          <button class="props-attachment-remove" data-att-id="${att.id}" title="Remove attachment">&times;</button>
        </div>
      `;
    }).join('');
  }

  /**
   * Format bytes as human-readable size
   */
  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  /**
   * Bind delete events on attachment remove buttons
   */
  function bindAttachmentDeleteEvents() {
    document.querySelectorAll('.props-attachment-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const attId = btn.dataset.attId;
        if (!currentNodeId) return;
        const node = State.getNodeById(currentNodeId);
        const updated = (node.attachments || []).filter(a => a.id !== attId);
        State.updateNode(currentNodeId, { attachments: updated });
        const updatedNode = State.getNodeById(currentNodeId);
        if (updatedNode) NodeRenderer.renderNode(updatedNode);
        const listEl = document.getElementById('props-attachments-list');
        if (listEl) {
          listEl.innerHTML = renderAttachmentItems(updated);
          bindAttachmentDeleteEvents();
        }
        // Redraw connections — getPortPosition now reads live DOM height
        requestAnimationFrame(() => ConnectionRenderer.renderAll());
      });
    });
  }

  /**
   * Hide properties panel
   */
  function hide() {
    panelEl.classList.remove('visible');
    document.documentElement.style.setProperty('--props-w', '0px');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      ConnectionRenderer.renderAll();
    }, 260);
    currentNodeId = null;
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

    // Attach file button
    const attachBtn = document.getElementById('props-attach-btn');
    const fileInput = document.getElementById('props-file-input');

    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length || !currentNodeId) return;

        const node = State.getNodeById(currentNodeId);
        const existing = node.attachments || [];

        const newAttachments = await Promise.all(files.map(file => new Promise((resolve) => {
          if (file.size > 5 * 1024 * 1024) {
            showToast(`"${file.name}" is over 5MB — skipped`, 'error');
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => resolve({
            id: generateId('att'),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl: ev.target.result,
          });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })));

        const valid = newAttachments.filter(Boolean);
        if (!valid.length) return;

        const updated = [...existing, ...valid];
        State.updateNode(currentNodeId, { attachments: updated });
        const updatedNode = State.getNodeById(currentNodeId);
        if (updatedNode) NodeRenderer.renderNode(updatedNode);

        const listEl = document.getElementById('props-attachments-list');
        if (listEl) {
          listEl.innerHTML = renderAttachmentItems(updated);
          bindAttachmentDeleteEvents();
        }
        // Redraw connections after image paints — getPortPosition reads live DOM height
        requestAnimationFrame(() => {
          const el = Canvas.nodesLayer && Canvas.nodesLayer.querySelector(`[data-id="${currentNodeId}"]`);
          if (!el) { ConnectionRenderer.renderAll(); return; }
          const imgs = el.querySelectorAll('.node-attachment-img');
          if (imgs.length > 0) {
            const lastImg = imgs[imgs.length - 1];
            const redraw = () => ConnectionRenderer.renderAll();
            if (lastImg.complete) redraw();
            else {
              lastImg.addEventListener('load', redraw, { once: true });
              lastImg.addEventListener('error', redraw, { once: true });
            }
          } else {
            ConnectionRenderer.renderAll();
          }
        });
        e.target.value = '';
      });
    }

    // Initial attachment delete bindings
    bindAttachmentDeleteEvents();

    // Delete node
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
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init, show, hide, get currentNodeId() { return currentNodeId; } };
})();
