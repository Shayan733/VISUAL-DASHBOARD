/* ============================================
   Command Palette — Node type picker
   Triggered by double-clicking empty canvas
   ============================================ */

const CommandPalette = (() => {

  const NODE_TYPES = [
    {
      key: 'default',
      label: 'Node',
      description: 'A general-purpose node',
      icon: '⬡',
      color: '#818cf8',
      portLabels: { left: 'Input', right: 'Output' },
    },
    {
      key: 'task',
      label: 'Task',
      description: 'An action or work item',
      icon: '✓',
      color: '#a78bfa',
      portLabels: { left: 'Input', right: 'Output' },
    },
    {
      key: 'decision',
      label: 'Decision',
      description: 'A branch or conditional',
      icon: '◆',
      color: '#fbbf24',
      portLabels: { left: 'Input', right: 'Result' },
    },
    {
      key: 'process',
      label: 'Process',
      description: 'A sequence of steps',
      icon: '⚙',
      color: '#34d399',
      portLabels: { left: 'In', right: 'Out' },
    },
    {
      key: 'data',
      label: 'Data',
      description: 'A data store or variable',
      icon: '◉',
      color: '#22d3ee',
      portLabels: { left: 'Write', right: 'Read' },
    },
    {
      key: 'api',
      label: 'API',
      description: 'An API call or endpoint',
      icon: '↗',
      color: '#fb923c',
      portLabels: { left: 'Request', right: 'Response' },
    },
    {
      key: 'trigger',
      label: 'Trigger',
      description: 'A start event or trigger',
      icon: '⚡',
      color: '#fb7185',
      portLabels: { left: null, right: 'Output' },
    },
    {
      key: 'sticky',
      label: 'Note',
      description: 'A free-floating sticky note',
      icon: '✎',
      color: '#fbbf24',
      portLabels: { left: null, right: null },
    },
  ];

  let paletteEl = null;
  let containerEl = null;
  let listEl = null;
  let inputEl = null;
  let pendingCanvasPos = { x: 0, y: 0 };
  let activeIndex = -1;
  let filteredTypes = [...NODE_TYPES];

  function init() {
    paletteEl = document.getElementById('command-palette');
    containerEl = paletteEl.querySelector('.cp-container');
    listEl = document.getElementById('cp-list');
    inputEl = document.getElementById('cp-input');

    // Close when clicking outside the container
    paletteEl.addEventListener('mousedown', (e) => {
      if (e.target === paletteEl) close();
    });

    inputEl.addEventListener('input', () => {
      activeIndex = -1;
      renderList(inputEl.value);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectActive();
      } else if (e.key === 'Escape') {
        close();
      }
    });
  }

  function open(screenX, screenY, canvasX, canvasY) {
    pendingCanvasPos = { x: canvasX, y: canvasY };

    // Position container near the click, clamped to viewport
    const w = 300;
    const h = 380;
    const left = Math.min(screenX - 12, window.innerWidth - w - 16);
    const top  = Math.min(screenY - 12, window.innerHeight - h - 16);
    containerEl.style.left = Math.max(8, left) + 'px';
    containerEl.style.top  = Math.max(8, top)  + 'px';

    paletteEl.classList.remove('hidden');
    inputEl.value = '';
    activeIndex = -1;
    renderList('');
    requestAnimationFrame(() => inputEl.focus());
  }

  function close() {
    paletteEl.classList.add('hidden');
    inputEl.value = '';
    activeIndex = -1;
  }

  function isOpen() {
    return !paletteEl.classList.contains('hidden');
  }

  function renderList(query) {
    const q = query.toLowerCase().trim();
    filteredTypes = q
      ? NODE_TYPES.filter(
          t =>
            t.label.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        )
      : NODE_TYPES;

    if (filteredTypes.length === 0) {
      listEl.innerHTML = '<div class="cp-empty">No results</div>';
      return;
    }

    listEl.innerHTML = filteredTypes
      .map(
        (type, i) => `
      <div class="cp-item ${i === activeIndex ? 'active' : ''}" data-index="${i}">
        <div class="cp-item-icon" style="background:${type.color}22; border-color:${type.color}55; color:${type.color}">${type.icon}</div>
        <div class="cp-item-info">
          <div class="cp-item-name">${type.label}</div>
          <div class="cp-item-desc">${type.description}</div>
        </div>
      </div>`
      )
      .join('');

    listEl.querySelectorAll('.cp-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        createNode(filteredTypes[parseInt(item.dataset.index)]);
      });
    });
  }

  function moveActive(dir) {
    activeIndex = Math.max(0, Math.min(filteredTypes.length - 1, activeIndex + dir));
    renderList(inputEl.value);
    const activeEl = listEl.querySelector('.cp-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function selectActive() {
    if (activeIndex >= 0 && filteredTypes[activeIndex]) {
      createNode(filteredTypes[activeIndex]);
    } else if (filteredTypes.length > 0) {
      createNode(filteredTypes[0]);
    }
  }

  function createNode(type) {
    close();

    const isSticky = type.key === 'sticky';
    const node = State.addNode({
      type: isSticky ? 'sticky' : 'node',
      label: type.label,
      x: pendingCanvasPos.x - 90,
      y: pendingCanvasPos.y - (isSticky ? 50 : 30),
      width: isSticky ? 180 : 200,
      color: type.color,
      nodeType: type.key,
      portLabels: isSticky ? null : type.portLabels,
    });

    NodeRenderer.renderNode(node);
    Selection.select(node.id);

    const el = Canvas.nodesLayer.querySelector(`[data-id="${node.id}"]`);
    if (!el) return;

    // Sticky notes: focus the textarea directly
    if (isSticky) {
      setTimeout(() => el.querySelector('.sticky-text')?.focus(), 60);
      return;
    }

    // Regular nodes: start label editing
    const labelEl = el.querySelector('.node-label');
    if (!labelEl) return;

    setTimeout(() => {
      labelEl.setAttribute('contenteditable', 'true');
      labelEl.focus();
      const range = document.createRange();
      range.selectNodeContents(labelEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const finish = () => {
        labelEl.removeAttribute('contenteditable');
        const newLabel = labelEl.textContent.trim() || type.label;
        labelEl.textContent = newLabel;
        State.updateNode(node.id, { label: newLabel });
      };
      labelEl.addEventListener('blur', finish, { once: true });
      labelEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); labelEl.blur(); }
        if (e.key === 'Escape') { labelEl.textContent = type.label; labelEl.blur(); }
      });
    }, 50);
  }

  return { init, open, close, isOpen };
})();
