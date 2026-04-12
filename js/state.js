/* ============================================
   State Manager — Central state, save/load
   ============================================ */

const State = (() => {
  // Central application state
  let state = {
    canvas: { offsetX: 0, offsetY: 0, zoom: 1 },
    nodes: [],
    connections: [],
  };

  // Read-only mode flag
  let readOnly = false;

  // Subscribers for state changes
  const listeners = [];

  /**
   * Get the current state (deep clone for safety)
   */
  function getState() {
    return state;
  }

  /**
   * Get all nodes
   */
  function getNodes() {
    return state.nodes;
  }

  /**
   * Get all connections
   */
  function getConnections() {
    return state.connections;
  }

  /**
   * Find node by ID
   */
  function getNodeById(id) {
    return state.nodes.find(n => n.id === id) || null;
  }

  /**
   * Find connection by ID
   */
  function getConnectionById(id) {
    return state.connections.find(c => c.id === id) || null;
  }

  /**
   * Get all child nodes of a group
   */
  function getChildren(parentId) {
    return state.nodes.filter(n => n.parentId === parentId);
  }

  /**
   * Add a node to state
   */
  function addNode(nodeData) {
    const node = {
      id: generateId('node'),
      type: 'node',
      label: 'New Node',
      description: '',
      x: 0,
      y: 0,
      width: 180,
      height: 60,
      color: '#818cf8',
      status: null,
      parentId: null,
      collapsed: false,
      ...nodeData,
    };
    state.nodes.push(node);
    History.push();
    notify('node-added', node);
    return node;
  }

  /**
   * Add a group to state
   */
  function addGroup(groupData) {
    const group = {
      id: generateId('group'),
      type: 'group',
      label: 'New Group',
      description: '',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      color: '#818cf8',
      status: null,
      parentId: null,
      collapsed: false,
      ...groupData,
    };
    state.nodes.push(group);
    History.push();
    notify('node-added', group);
    return group;
  }

  /**
   * Update a node's properties
   */
  function updateNode(id, updates) {
    const node = getNodeById(id);
    if (!node) return null;
    Object.assign(node, updates);
    notify('node-updated', node);
    return node;
  }

  /**
   * Delete a node and its connections
   */
  function deleteNode(id) {
    const node = getNodeById(id);
    if (!node) return;

    // If it's a group, also delete children (or orphan them)
    if (node.type === 'group') {
      const children = getChildren(id);
      children.forEach(child => {
        child.parentId = null;
        // Convert child positions to absolute
        child.x += node.x;
        child.y += node.y;
        notify('node-updated', child);
      });
    }

    // Remove connections involving this node
    state.connections = state.connections.filter(
      c => c.sourceId !== id && c.targetId !== id
    );

    // Remove the node
    state.nodes = state.nodes.filter(n => n.id !== id);

    History.push();
    notify('node-deleted', { id });
  }

  /**
   * Delete multiple nodes
   */
  function deleteNodes(ids) {
    ids.forEach(id => {
      const node = getNodeById(id);
      if (!node) return;

      if (node.type === 'group') {
        const children = getChildren(id);
        children.forEach(child => {
          child.parentId = null;
          child.x += node.x;
          child.y += node.y;
        });
      }

      state.connections = state.connections.filter(
        c => c.sourceId !== id && c.targetId !== id
      );
      state.nodes = state.nodes.filter(n => n.id !== id);
    });

    History.push();
    notify('nodes-deleted', { ids });
  }

  /**
   * Add a connection
   */
  function addConnection(connData) {
    // Don't add duplicate connections
    const exists = state.connections.find(
      c => c.sourceId === connData.sourceId &&
           c.targetId === connData.targetId &&
           c.sourcePort === connData.sourcePort &&
           c.targetPort === connData.targetPort
    );
    if (exists) return exists;

    // Don't connect to self
    if (connData.sourceId === connData.targetId) return null;

    const conn = {
      id: generateId('conn'),
      sourceId: '',
      targetId: '',
      sourcePort: 'right',
      targetPort: 'left',
      label: '',
      animated: true,
      ...connData,
    };
    state.connections.push(conn);
    History.push();
    notify('connection-added', conn);
    return conn;
  }

  /**
   * Update a connection
   */
  function updateConnection(id, updates) {
    const conn = getConnectionById(id);
    if (!conn) return null;
    Object.assign(conn, updates);
    notify('connection-updated', conn);
    return conn;
  }

  /**
   * Delete a connection
   */
  function deleteConnection(id) {
    state.connections = state.connections.filter(c => c.id !== id);
    History.push();
    notify('connection-deleted', { id });
  }

  /**
   * Duplicate nodes
   */
  function duplicateNodes(ids) {
    const newNodes = [];
    const idMap = {};

    ids.forEach(id => {
      const original = getNodeById(id);
      if (!original) return;

      const newId = generateId(original.type);
      idMap[id] = newId;

      const clone = deepClone(original);
      clone.id = newId;
      clone.x += 30;
      clone.y += 30;
      clone.label += ' (copy)';

      state.nodes.push(clone);
      newNodes.push(clone);
    });

    // Duplicate connections between duplicated nodes
    state.connections.forEach(conn => {
      if (idMap[conn.sourceId] && idMap[conn.targetId]) {
        state.connections.push({
          ...deepClone(conn),
          id: generateId('conn'),
          sourceId: idMap[conn.sourceId],
          targetId: idMap[conn.targetId],
        });
      }
    });

    History.push();
    newNodes.forEach(n => notify('node-added', n));
    return newNodes;
  }

  /**
   * Get the absolute position of a node (resolving parent chain)
   */
  function getAbsolutePosition(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return { x: 0, y: 0 };

    let x = node.x;
    let y = node.y;

    if (node.parentId) {
      const parentPos = getAbsolutePosition(node.parentId);
      x += parentPos.x;
      y += parentPos.y;
    }

    return { x, y };
  }

  /* ── Persistence ── */

  const STORAGE_KEY = 'visual-dashboard-state';

  /**
   * Save state to localStorage
   */
  function save() {
    state.canvas = {
      offsetX: Canvas.offsetX,
      offsetY: Canvas.offsetY,
      zoom: Canvas.zoom,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      notify('saved', null);
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  /**
   * Load state from localStorage
   */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw);
        // Restore canvas transform
        if (state.canvas) {
          Canvas.offsetX = state.canvas.offsetX || 0;
          Canvas.offsetY = state.canvas.offsetY || 0;
          Canvas.zoom = state.canvas.zoom || 1;
          Canvas.updateTransform();
        }
        notify('loaded', state);
        return true;
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    return false;
  }

  /**
   * Export state as JSON download
   */
  function exportJSON() {
    state.canvas = {
      offsetX: Canvas.offsetX,
      offsetY: Canvas.offsetY,
      zoom: Canvas.zoom,
    };
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visual-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import state from JSON file
   */
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          state = imported;
          if (state.canvas) {
            Canvas.offsetX = state.canvas.offsetX || 0;
            Canvas.offsetY = state.canvas.offsetY || 0;
            Canvas.zoom = state.canvas.zoom || 1;
            Canvas.updateTransform();
          }
          History.clear();
          History.push();
          notify('loaded', state);
          resolve(state);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Clear all state
   */
  function clearAll() {
    state.nodes = [];
    state.connections = [];
    History.push();
    notify('cleared', null);
  }

  /**
   * Replace entire state (used by undo/redo)
   */
  function replaceState(newState) {
    state = newState;
    notify('loaded', state);
  }

  /**
   * Load state from JSON object
   */
  function loadFromJSON(jsonData) {
    try {
      state = {
        canvas: jsonData.canvas || { offsetX: 0, offsetY: 0, zoom: 1 },
        nodes: jsonData.nodes || [],
        connections: jsonData.connections || [],
      };
      notify('loaded', state);
      return true;
    } catch (error) {
      console.error('Failed to load JSON:', error);
      return false;
    }
  }

  /**
   * Export current state as JSON
   */
  function toJSON() {
    return state;
  }

  /* ── Events ── */

  function on(callback) {
    listeners.push(callback);
  }

  function off(callback) {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  }

  function notify(event, data) {
    listeners.forEach(cb => cb(event, data));
  }

  // Auto-save every 30 seconds
  setInterval(() => save(), 30000);

  return {
    getState,
    getNodes,
    getConnections,
    getNodeById,
    getConnectionById,
    getChildren,
    getAbsolutePosition,
    addNode,
    addGroup,
    updateNode,
    deleteNode,
    deleteNodes,
    addConnection,
    updateConnection,
    deleteConnection,
    duplicateNodes,
    save,
    load,
    loadFromJSON,
    toJSON,
    exportJSON,
    importJSON,
    clearAll,
    replaceState,
    on,
    off,
    get readOnly() { return readOnly; },
    set readOnly(value) { readOnly = value; },
  };
})();
