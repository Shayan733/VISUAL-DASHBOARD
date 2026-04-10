/* ============================================
   Context Menu — Right-click menus
   ============================================ */

const ContextMenu = (() => {
  let menuEl = null;
  let currentTarget = null; // { type: 'canvas' | 'node' | 'group' | 'connection', id?: string, x: number, y: number }

  function init() {
    menuEl = document.getElementById('context-menu');

    // Right-click handler
    Canvas.container.addEventListener('contextmenu', onContextMenu);

    // Close on click anywhere
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', (e) => {
      if (!Canvas.container.contains(e.target)) close();
    });
  }

  function onContextMenu(e) {
    e.preventDefault();

    const target = e.target;
    const canvasPos = Canvas.screenToCanvas(e.clientX, e.clientY);

    // Determine what was right-clicked
    const nodeEl = target.closest('.canvas-node');
    const connEl = target.closest('.connection-group');

    if (nodeEl) {
      const nodeId = nodeEl.dataset.id;
      const node = State.getNodeById(nodeId);
      if (node) {
        if (node.type === 'group') {
          currentTarget = { type: 'group', id: nodeId, x: canvasPos.x, y: canvasPos.y };
          showGroupMenu(e.clientX, e.clientY, node);
        } else {
          currentTarget = { type: 'node', id: nodeId, x: canvasPos.x, y: canvasPos.y };
          showNodeMenu(e.clientX, e.clientY, node);
        }
        // Ensure it's selected
        if (!Selection.isSelected(nodeId)) {
          Selection.select(nodeId);
        }
      }
    } else if (connEl) {
      const connId = connEl.dataset.id;
      currentTarget = { type: 'connection', id: connId, x: canvasPos.x, y: canvasPos.y };
      showConnectionMenu(e.clientX, e.clientY);
    } else {
      currentTarget = { type: 'canvas', x: canvasPos.x, y: canvasPos.y };
      showCanvasMenu(e.clientX, e.clientY);
    }
  }

  function showCanvasMenu(x, y) {
    menuEl.innerHTML = `
      <div class="ctx-item" data-action="add-node">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        New Node Here
      </div>
      <div class="ctx-item" data-action="add-group">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3" stroke-dasharray="4 2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        New Group Here
      </div>
      <div class="ctx-separator"></div>
      <div class="ctx-item" data-action="fit-view">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        Fit View
      </div>
      <div class="ctx-item" data-action="select-all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Select All
        <span class="ctx-shortcut">⌘A</span>
      </div>
    `;
    show(x, y);
    bindActions();
  }

  function showNodeMenu(x, y, node) {
    const statusDef = STATUSES.find(s => s.key === node.status) || STATUSES[0];
    const colorSwatches = NODE_COLORS.map(c =>
      `<div class="ctx-color-swatch ${c.value === node.color ? 'active' : ''}" 
            style="background:${c.value}" data-action="set-color" data-color="${c.value}"
            title="${c.name}"></div>`
    ).join('');

    menuEl.innerHTML = `
      <div class="ctx-item" data-action="edit-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit Label
      </div>
      <div class="ctx-item" data-action="toggle-description">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
        Toggle Description
      </div>
      <div class="ctx-separator"></div>
      <div class="ctx-item" data-action="cycle-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Status: ${statusDef.label}
      </div>
      <div class="ctx-separator"></div>
      <div class="ctx-header">Color</div>
      <div class="ctx-color-row">${colorSwatches}</div>
      <div class="ctx-separator"></div>
      <div class="ctx-item" data-action="duplicate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Duplicate
        <span class="ctx-shortcut">⌘D</span>
      </div>
      <div class="ctx-item danger" data-action="delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Delete
        <span class="ctx-shortcut">⌫</span>
      </div>
    `;
    show(x, y);
    bindActions();
  }

  function showGroupMenu(x, y, node) {
    const collapsed = node.collapsed;
    const colorSwatches = NODE_COLORS.map(c =>
      `<div class="ctx-color-swatch ${c.value === node.color ? 'active' : ''}" 
            style="background:${c.value}" data-action="set-color" data-color="${c.value}"
            title="${c.name}"></div>`
    ).join('');

    menuEl.innerHTML = `
      <div class="ctx-item" data-action="edit-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit Label
      </div>
      <div class="ctx-item" data-action="add-node-inside">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Add Node Inside
      </div>
      <div class="ctx-item" data-action="toggle-collapse">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="${collapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'}"/></svg>
        ${collapsed ? 'Expand' : 'Collapse'}
      </div>
      <div class="ctx-separator"></div>
      <div class="ctx-header">Color</div>
      <div class="ctx-color-row">${colorSwatches}</div>
      <div class="ctx-separator"></div>
      <div class="ctx-item danger" data-action="delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Delete Group
        <span class="ctx-shortcut">⌫</span>
      </div>
    `;
    show(x, y);
    bindActions();
  }

  function showConnectionMenu(x, y) {
    menuEl.innerHTML = `
      <div class="ctx-item" data-action="edit-conn-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit Label
      </div>
      <div class="ctx-item danger" data-action="delete-connection">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Delete Connection
      </div>
    `;
    show(x, y);
    bindActions();
  }

  function show(x, y) {
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
    menuEl.classList.add('visible');

    // Adjust if off-screen
    requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuEl.style.left = (x - rect.width) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menuEl.style.top = (y - rect.height) + 'px';
      }
    });
  }

  function close() {
    if (menuEl) {
      menuEl.classList.remove('visible');
    }
    currentTarget = null;
  }

  function bindActions() {
    menuEl.querySelectorAll('[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        executeAction(item.dataset.action, item.dataset);
        close();
      });
    });
  }

  function executeAction(action, dataset) {
    if (!currentTarget) return;

    switch (action) {
      case 'add-node': {
        const node = State.addNode({
          x: currentTarget.x - 90,
          y: currentTarget.y - 30,
        });
        NodeRenderer.renderNode(node);
        Selection.select(node.id);
        break;
      }

      case 'add-group': {
        const group = State.addGroup({
          x: currentTarget.x - 200,
          y: currentTarget.y - 30,
        });
        NodeRenderer.renderNode(group);
        Selection.select(group.id);
        break;
      }

      case 'add-node-inside': {
        const parentNode = State.getNodeById(currentTarget.id);
        if (parentNode) {
          const node = State.addNode({
            x: 20,
            y: 60,
            parentId: parentNode.id,
          });
          NodeRenderer.renderAll();
          ConnectionRenderer.renderAll();
          Selection.select(node.id);
        }
        break;
      }

      case 'edit-label': {
        const el = Canvas.nodesLayer.querySelector(`[data-id="${currentTarget.id}"]`);
        if (el) {
          const label = el.querySelector('.node-label, .group-label');
          if (label) {
            const node = State.getNodeById(currentTarget.id);
            label.setAttribute('contenteditable', 'true');
            label.focus();
            const range = document.createRange();
            range.selectNodeContents(label);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);

            const finish = () => {
              label.removeAttribute('contenteditable');
              const newLabel = label.textContent.trim() || 'Untitled';
              State.updateNode(currentTarget.id, { label: newLabel });
            };
            label.addEventListener('blur', finish, { once: true });
            label.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
            });
          }
        }
        break;
      }

      case 'toggle-description': {
        const el = Canvas.nodesLayer.querySelector(`[data-id="${currentTarget.id}"]`);
        if (el) {
          el.classList.toggle('expanded');
          const textarea = el.querySelector('.node-description textarea');
          if (textarea && el.classList.contains('expanded')) {
            setTimeout(() => textarea.focus(), 100);
          }
        }
        break;
      }

      case 'cycle-status': {
        const node = State.getNodeById(currentTarget.id);
        if (node) {
          State.updateNode(node.id, { status: cycleStatus(node.status) });
          NodeRenderer.renderNode(node);
        }
        break;
      }

      case 'set-color': {
        const color = dataset.color;
        if (color && currentTarget.id) {
          State.updateNode(currentTarget.id, { color });
          const node = State.getNodeById(currentTarget.id);
          if (node) NodeRenderer.renderNode(node);
          ConnectionRenderer.renderAll();
        }
        break;
      }

      case 'toggle-collapse': {
        const node = State.getNodeById(currentTarget.id);
        if (node) {
          State.updateNode(node.id, { collapsed: !node.collapsed });
          NodeRenderer.renderNode(node);
        }
        break;
      }

      case 'duplicate': {
        const selectedIds = Selection.getSelected();
        if (selectedIds.length > 0) {
          const newNodes = State.duplicateNodes(selectedIds);
          Selection.clearSelection();
          newNodes.forEach(n => {
            NodeRenderer.renderNode(n);
            Selection.select(n.id, true);
          });
          ConnectionRenderer.renderAll();
        }
        break;
      }

      case 'delete': {
        Toolbar.deleteSelected();
        break;
      }

      case 'edit-conn-label': {
        const conn = State.getConnectionById(currentTarget.id);
        if (conn) {
          const newLabel = prompt('Connection label:', conn.label || '');
          if (newLabel !== null) {
            State.updateConnection(conn.id, { label: newLabel });
            ConnectionRenderer.renderAll();
          }
        }
        break;
      }

      case 'delete-connection': {
        State.deleteConnection(currentTarget.id);
        ConnectionRenderer.renderAll();
        NodeRenderer.renderAll();
        break;
      }

      case 'fit-view': {
        Canvas.fitView(State.getNodes());
        break;
      }

      case 'select-all': {
        Selection.selectAll();
        break;
      }
    }
  }

  return { init, close };
})();
