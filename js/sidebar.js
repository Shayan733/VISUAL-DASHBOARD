/* ============================================
   Sidebar — Canvas list UI and interactions
   ============================================ */

const Sidebar = (() => {
  const updateUserInfo = () => {
    const user = State.user;
    if (!user) return;

    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    const emailEl  = document.getElementById('user-email');

    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar">`;
      } else {
        const initial = (user.displayName || user.email || '?')[0].toUpperCase();
        avatarEl.textContent = initial;
      }
    }
    if (nameEl) {
      nameEl.textContent = user.displayName || user.email?.split('@')[0] || 'User';
    }
    if (emailEl) {
      emailEl.textContent = user.email || '';
    }
  };

  const init = () => {
    const createBtn = document.getElementById('create-canvas-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const name = prompt('Canvas name:', 'New Canvas');
        if (name) {
          await Sync.createCanvas(name);
          await refresh();
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await FirebaseAuth.logout();
      });
    }

    updateUserInfo();

    // Sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
      // Restore saved collapsed state
      // REMOVED: --sidebar-w setProperty — flex handles canvas width automatically
      const savedCollapsed = localStorage.getItem('vd-sidebar-collapsed') === 'true';
      if (savedCollapsed) {
        document.getElementById('sidebar').classList.add('collapsed');
      }

      toggleBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const isCollapsed = sidebar.classList.toggle('collapsed');
        // REMOVED: toggleBtn.classList.toggle — CSS uses #sidebar.collapsed .sidebar-toggle-btn svg
        // REMOVED: --sidebar-w setProperty — flex handles canvas width automatically
        localStorage.setItem('vd-sidebar-collapsed', isCollapsed);
        // After the 200ms width transition, redraw grid and connections
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          if (typeof ConnectionRenderer !== 'undefined') ConnectionRenderer.renderAll();
        }, 210);
      });
    }

    refresh();
  };

  const refresh = async () => {
    const canvases = await Sync.listCanvases();
    renderCanvases(canvases);
  };

  const updateActive = (canvasId) => {
    document.querySelectorAll('.canvas-item').forEach(item => {
      item.classList.toggle('active', item.dataset.canvasId === canvasId);
    });
  };

  const renderCanvases = (canvases) => {
    const list = document.getElementById('canvas-list');
    if (!list) return;

    list.innerHTML = '';

    if (canvases.length === 0) {
      list.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted);">No canvases yet</div>';
      return;
    }

    canvases.forEach(canvas => {
      const item = document.createElement('div');
      item.className = 'canvas-item';
      item.dataset.canvasId = canvas.id;
      item.classList.toggle('active', canvas.id === State.currentCanvasId);

      const timeAgo = canvas.updatedAt ? getTimeAgo(canvas.updatedAt.toDate ? canvas.updatedAt.toDate() : canvas.updatedAt) : 'just now';
      const dotColor = canvas.color || '818cf8';

      item.innerHTML = `
        <div class="canvas-dot" style="background: #${dotColor};"></div>
        <div class="canvas-info">
          <div class="canvas-name">${escapeHtml(canvas.name)}</div>
          <div class="canvas-time">${timeAgo}</div>
        </div>
      `;

      item.addEventListener('click', () => Sync.loadCanvas(canvas.id));

      // Right-click menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showCanvasContextMenu(canvas, item, e);
      });

      list.appendChild(item);
    });
  };

  const CANVAS_COLORS = [
    { name: 'Violet',  hex: 'a78bfa' },
    { name: 'Indigo',  hex: '818cf8' },
    { name: 'Cyan',    hex: '22d3ee' },
    { name: 'Emerald', hex: '34d399' },
    { name: 'Amber',   hex: 'fbbf24' },
    { name: 'Rose',    hex: 'fb7185' },
    { name: 'Orange',  hex: 'fb923c' },
    { name: 'Slate',   hex: '64748b' },
  ];

  const showCanvasContextMenu = (canvas, item, e) => {
    const existing = document.getElementById('canvas-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'canvas-ctx-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${Math.min(e.clientX, window.innerWidth - 200)}px;
      top: ${Math.min(e.clientY, window.innerHeight - 240)}px;
      background: #0d0f16;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 6px;
      z-index: 10000;
      min-width: 180px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      font-family: inherit;
    `;

    // ── Color picker section ──
    const colorLabel = document.createElement('div');
    colorLabel.textContent = 'Project Color';
    colorLabel.style.cssText = 'font-size:10px;color:#555970;text-transform:uppercase;letter-spacing:0.5px;padding:4px 6px 6px;';
    menu.appendChild(colorLabel);

    const swatchRow = document.createElement('div');
    swatchRow.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:0 4px 8px;';
    CANVAS_COLORS.forEach(({ name, hex }) => {
      const swatch = document.createElement('button');
      swatch.title = name;
      swatch.style.cssText = `
        width:20px;height:20px;border-radius:50%;background:#${hex};border:2px solid ${canvas.color === hex ? '#fff' : 'transparent'};
        cursor:pointer;transition:transform 0.1s,border-color 0.1s;flex-shrink:0;
      `;
      swatch.addEventListener('mouseenter', () => swatch.style.transform = 'scale(1.2)');
      swatch.addEventListener('mouseleave', () => swatch.style.transform = '');
      swatch.addEventListener('click', () => {
        Sync.updateCanvasMeta(canvas.id, { color: hex });
        const dot = item.querySelector('.canvas-dot');
        if (dot) dot.style.background = `#${hex}`;
        menu.remove();
      });
      swatchRow.appendChild(swatch);
    });
    menu.appendChild(swatchRow);

    // ── Divider ──
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.07);margin:2px 0 6px;';
    menu.appendChild(divider);

    // ── Action buttons ──
    const actions = [
      { label: 'Rename', icon: '✏️', action: async () => {
        const name = prompt('Rename canvas:', canvas.name);
        if (name && name.trim() && name.trim() !== canvas.name) {
          await Sync.updateCanvasMeta(canvas.id, { name: name.trim() });
        }
      }},
      { label: 'Duplicate', icon: '⎘', action: () => Sync.duplicateCanvas(canvas.id) },
      { label: 'Delete', icon: '🗑', danger: true, action: () => {
        if (confirm(`Delete "${canvas.name}"? This cannot be undone.`)) {
          Sync.deleteCanvas(canvas.id);
        }
      }},
    ];

    actions.forEach(({ label, icon, danger, action }) => {
      const btn = document.createElement('button');
      btn.innerHTML = `<span style="opacity:0.6;margin-right:7px">${icon}</span>${label}`;
      btn.style.cssText = `
        display:flex;align-items:center;width:100%;padding:7px 8px;background:transparent;border:none;
        border-radius:5px;text-align:left;font-size:12px;color:${danger ? '#fb7185' : '#c0c0d0'};
        cursor:pointer;transition:background 0.1s;
      `;
      btn.addEventListener('mouseenter', () => btn.style.background = danger ? 'rgba(251,113,133,0.1)' : 'rgba(255,255,255,0.06)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      btn.addEventListener('click', () => { action(); menu.remove(); });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', () => { if (menu.parentNode) menu.remove(); }, { once: true });
    }, 0);
  };

  return { init, refresh, updateActive };
})();

/**
 * Format timestamp as "X time ago"
 */
function getTimeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
