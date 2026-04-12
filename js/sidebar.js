/* ============================================
   Sidebar — Canvas list UI and interactions
   ============================================ */

const Sidebar = (() => {
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
        await Auth.logout();
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

      const timeAgo = getTimeAgo(canvas.updated_at);

      item.innerHTML = `
        <div class="canvas-dot" style="background: #${canvas.color};"></div>
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

  const showCanvasContextMenu = (canvas, item, e) => {
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border-rest);
      border-radius: 4px;
      padding: 4px 0;
      z-index: 10000;
      min-width: 150px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    const menuOptions = [
      { label: 'Duplicate', action: () => Sync.duplicateCanvas(canvas.id) },
      { label: 'Delete', action: () => {
        if (confirm(`Delete "${canvas.name}"?`)) {
          Sync.deleteCanvas(canvas.id);
        }
      }}
    ];

    menuOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.className = 'canvas-context-menu-item';
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        text-align: left;
        font-size: 12px;
        color: #E0E0E0;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#252525';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', () => {
        opt.action();
        document.body.removeChild(menu);
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', () => {
        if (menu.parentNode) document.body.removeChild(menu);
      }, { once: true });
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
