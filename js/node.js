/* ============================================
   Node — CRUD, rendering, editing
   ============================================ */

const NodeRenderer = (() => {

  /**
   * Create the DOM element for a node
   */
  function createNodeElement(node) {
    const el = document.createElement('div');
    el.className = `canvas-node ${node.type === 'group' ? 'group-node' : ''} entering`;
    el.dataset.id = node.id;
    el.dataset.type = node.type;

    // Always use absolute position for DOM placement
    const absPos = State.getAbsolutePosition(node.id);
    el.style.left = absPos.x + 'px';
    el.style.top = absPos.y + 'px';
    el.style.width = node.width + 'px';
    if (node.type === 'group') {
      el.style.height = node.height + 'px';
    }

    if (node.type === 'group') {
      el.innerHTML = buildGroupHTML(node);
    } else {
      el.innerHTML = buildNodeHTML(node);
    }

    // Add connection ports (with optional labels from node data)
    appendPorts(el, node.portLabels);

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'node-resize-handle';
    el.appendChild(resizeHandle);

    // Remove entering animation class after animation
    setTimeout(() => el.classList.remove('entering'), 300);

    return el;
  }

  /**
   * Build inner HTML for a regular node
   */
  function buildNodeHTML(node) {
    const statusDef = STATUSES.find(s => s.key === node.status) || STATUSES[0];
    const statusStyle = node.status
      ? `background: ${statusDef.color}20; border-color: ${statusDef.color}; color: ${statusDef.color};`
      : '';

    return `
      <div class="node-accent" style="background: ${node.color}"></div>
      <div class="node-header">
        <div class="node-status-badge" title="Status: ${statusDef.label}" style="${statusStyle}">
          ${statusDef.icon}
        </div>
        <div class="node-label">${escapeHTML(node.label)}</div>
      </div>
      <div class="node-description">
        <textarea placeholder="Add description...">${escapeHTML(node.description || '')}</textarea>
      </div>
      <div class="node-footer" id="footer-${node.id}">
        ${node.attachments && node.attachments.length > 0 ? `
          <div class="attachment-count-badge" data-node-id="${node.id}">
            ${Attachments.PAPERCLIP_SVG}
            <span>${node.attachments.length}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Build inner HTML for a group
   */
  function buildGroupHTML(node) {
    const children = State.getChildren(node.id);
    return `
      <div class="group-color-strip" style="background: ${node.color}"></div>
      <div class="group-header">
        <button class="group-collapse-btn" title="Collapse/Expand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="group-label">${escapeHTML(node.label)}</div>
        <span class="group-count">${children.length}</span>
      </div>
      <div class="group-body"></div>
    `;
  }

  /**
   * Add connection port circles to a node element
   * portLabels: { left: 'Input', right: 'Output' } — optional labels for left/right ports
   */
  function appendPorts(el, portLabels) {
    ['top', 'right', 'bottom', 'left'].forEach(dir => {
      const port = document.createElement('div');
      port.className = `node-port port-${dir}`;
      port.dataset.port = dir;

      // Add label for left/right ports if provided
      const label = portLabels && portLabels[dir];
      if (label && (dir === 'left' || dir === 'right')) {
        const span = document.createElement('span');
        span.className = 'port-label';
        span.textContent = label;
        port.appendChild(span);
      }

      el.appendChild(port);
    });
  }

  /**
   * Create the DOM element for a sticky note
   */
  function createStickyElement(note) {
    const el = document.createElement('div');
    el.className = 'canvas-node sticky-node entering';
    el.dataset.id = note.id;
    el.dataset.type = 'sticky';

    const absPos = State.getAbsolutePosition(note.id);
    el.style.left = absPos.x + 'px';
    el.style.top  = absPos.y + 'px';
    el.style.width = (note.width || 180) + 'px';
    if (note.height) el.style.minHeight = note.height + 'px';

    applyStickyColor(el, note.color || '#fbbf24');
    el.innerHTML = buildStickyHTML(note);

    // All 4 ports — no labels on sticky notes
    appendPorts(el, null);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'node-resize-handle';
    el.appendChild(resizeHandle);

    setTimeout(() => el.classList.remove('entering'), 300);
    return el;
  }

  function buildStickyHTML(note) {
    const color = note.color || '#fbbf24';
    return `
      <div class="sticky-header" style="background:${hexToRgba(color, 0.3)}">
        <svg class="sticky-icon" viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
          <path d="M2 0h10a2 2 0 0 1 2 2v9l-3 3H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm9 11h2.5L11 13.5V11z" opacity=".5"/>
        </svg>
        <span class="sticky-label">Note</span>
      </div>
      <textarea class="sticky-text" placeholder="Write a note...">${escapeHTML(note.description || '')}</textarea>
    `;
  }

  function applyStickyColor(el, hex) {
    el.style.background    = hexToRgba(hex, 0.12);
    el.style.borderColor   = hexToRgba(hex, 0.45);
    el.style.setProperty('--sticky-accent', hex);
  }

  function updateStickyElement(el, note) {
    const absPos = State.getAbsolutePosition(note.id);
    el.style.left  = absPos.x + 'px';
    el.style.top   = absPos.y + 'px';
    el.style.width = (note.width || 180) + 'px';
    if (note.height) el.style.minHeight = note.height + 'px';
    applyStickyColor(el, note.color || '#fbbf24');

    const header = el.querySelector('.sticky-header');
    if (header) header.style.background = hexToRgba(note.color || '#fbbf24', 0.3);
  }

  function bindStickyEvents(el, note) {
    const textarea = el.querySelector('.sticky-text');
    if (textarea) {
      textarea.addEventListener('input', () => {
        State.updateNode(note.id, { description: textarea.value });
      });
      textarea.addEventListener('mousedown', (e) => e.stopPropagation());
      textarea.addEventListener('focus',     (e) => e.stopPropagation());
      textarea.addEventListener('dblclick',  (e) => e.stopPropagation());
    }
  }

  /**
   * Render a node to the canvas (creates or updates)
   */
  function renderNode(node) {
    const nodesLayer = Canvas.nodesLayer;
    let el = nodesLayer.querySelector(`[data-id="${node.id}"]`);

    if (!el) {
      if (node.type === 'sticky') {
        el = createStickyElement(node);
        nodesLayer.appendChild(el);
        bindStickyEvents(el, node);
        updatePortStates(el, node.id);
      } else {
        el = createNodeElement(node);
        nodesLayer.appendChild(el);
        bindNodeEvents(el, node);
        updatePortStates(el, node.id);
      }
    } else {
      if (node.type === 'sticky') {
        updateStickyElement(el, node);
        updatePortStates(el, node.id);
      } else {
        updateNodeElement(el, node);
      }
    }

    return el;
  }

  /**
   * Update existing node element
   */
  function updateNodeElement(el, node) {
    // Always use absolute position for DOM placement
    const absPos = State.getAbsolutePosition(node.id);
    el.style.left = absPos.x + 'px';
    el.style.top = absPos.y + 'px';
    el.style.width = node.width + 'px';

    if (node.type === 'group') {
      el.style.height = node.height + 'px';

      const label = el.querySelector('.group-label');
      if (label && !label.hasAttribute('contenteditable')) {
        label.textContent = node.label;
      }

      const colorStrip = el.querySelector('.group-color-strip');
      if (colorStrip) colorStrip.style.background = node.color;

      const count = el.querySelector('.group-count');
      if (count) count.textContent = State.getChildren(node.id).length;

      if (node.collapsed) {
        el.classList.add('collapsed');
      } else {
        el.classList.remove('collapsed');
      }
    } else {
      const accent = el.querySelector('.node-accent');
      if (accent) accent.style.background = node.color;

      const label = el.querySelector('.node-label');
      if (label && !label.hasAttribute('contenteditable')) {
        label.textContent = node.label;
      }

      // Update status badge
      const badge = el.querySelector('.node-status-badge');
      if (badge) {
        const statusDef = STATUSES.find(s => s.key === node.status) || STATUSES[0];
        badge.textContent = statusDef.icon;
        badge.title = `Status: ${statusDef.label}`;
        if (node.status) {
          badge.style.background = `${statusDef.color}20`;
          badge.style.borderColor = statusDef.color;
          badge.style.color = statusDef.color;
        } else {
          badge.style.background = '';
          badge.style.borderColor = '';
          badge.style.color = '';
        }
      }
    }

    // Update attachment badge
    const footer = el.querySelector('.node-footer');
    if (footer && node.type !== 'group') {
      const count = node.attachments ? node.attachments.length : 0;
      footer.innerHTML = count > 0 ? `
        <div class="attachment-count-badge" data-node-id="${node.id}">
          ${Attachments.PAPERCLIP_SVG}
          <span>${count}</span>
        </div>
      ` : '';
    }

    // Update connected ports
    updatePortStates(el, node.id);
  }

  /**
   * Update port visual states (show filled if connected)
   */
  function updatePortStates(el, nodeId) {
    const connections = State.getConnections();
    const ports = el.querySelectorAll('.node-port');

    ports.forEach(port => {
      const dir = port.dataset.port;
      const isConnected = connections.some(
        c => (c.sourceId === nodeId && c.sourcePort === dir) ||
             (c.targetId === nodeId && c.targetPort === dir)
      );
      port.classList.toggle('connected', isConnected);
    });
  }

  /**
   * Remove a node from the DOM with animation
   */
  function removeNode(id) {
    const el = Canvas.nodesLayer.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('exiting');
      setTimeout(() => el.remove(), 200);
    }
  }

  /**
   * Bind events to a node element
   */
  function bindNodeEvents(el, node) {
    // Double-click to edit label
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const label = el.querySelector('.node-label, .group-label');
      if (label) {
        startEditing(label, node);
      }
    });

    // Status badge click
    const badge = el.querySelector('.node-status-badge');
    if (badge) {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentNode = State.getNodeById(node.id);
        if (currentNode) {
          State.updateNode(node.id, { status: cycleStatus(currentNode.status) });
          renderNode(currentNode);
        }
      });
    }

    // Group collapse button
    const collapseBtn = el.querySelector('.group-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentNode = State.getNodeById(node.id);
        if (currentNode) {
          State.updateNode(node.id, { collapsed: !currentNode.collapsed });
          const updatedNode = State.getNodeById(node.id);
          renderNode(updatedNode);
          ConnectionRenderer.renderAll();
        }
      });
    }

    // Attachment badge click → open properties panel
    el.addEventListener('click', (e) => {
      const badge = e.target.closest('.attachment-count-badge');
      if (badge) {
        e.stopPropagation();
        Properties.show(node.id);
      }
    });

    // Description textarea
    const descArea = el.querySelector('.node-description textarea');
    if (descArea) {
      descArea.addEventListener('input', (e) => {
        State.updateNode(node.id, { description: e.target.value });
      });
      descArea.addEventListener('mousedown', (e) => e.stopPropagation());
      descArea.addEventListener('focus', (e) => e.stopPropagation());
    }
  }

  /**
   * Start inline editing on a label
   */
  function startEditing(labelEl, node) {
    labelEl.setAttribute('contenteditable', 'true');
    labelEl.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(labelEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finishEdit = () => {
      labelEl.removeAttribute('contenteditable');
      const newLabel = labelEl.textContent.trim() || 'Untitled';
      labelEl.textContent = newLabel;
      State.updateNode(node.id, { label: newLabel });
    };

    labelEl.addEventListener('blur', finishEdit, { once: true });
    labelEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        labelEl.blur();
      }
      if (e.key === 'Escape') {
        labelEl.textContent = node.label;
        labelEl.blur();
      }
    });
  }

  /**
   * Render all nodes from state
   */
  function renderAll() {
    Canvas.nodesLayer.innerHTML = '';
    const nodes = State.getNodes();
    // Groups first (behind everything)
    nodes.filter(n => n.type === 'group').forEach(n => renderNode(n));
    // Regular nodes
    nodes.filter(n => n.type === 'node').forEach(n => renderNode(n));
    // Sticky notes on top
    nodes.filter(n => n.type === 'sticky').forEach(n => renderNode(n));
  }

  /**
   * Escape HTML entities
   */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    renderNode,
    renderAll,
    removeNode,
    updatePortStates,
    createNodeElement,
  };
})();
