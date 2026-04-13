/* ============================================
   Utility Functions
   ============================================ */

/**
 * Generate a unique ID with optional prefix
 */
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Distance between two points
 */
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Check if a point is inside a rectangle
 */
function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(r1, r2) {
  return !(
    r1.x + r1.width < r2.x ||
    r2.x + r2.width < r1.x ||
    r1.y + r1.height < r2.y ||
    r2.y + r2.height < r1.y
  );
}

/**
 * Get bounding rect of multiple items (nodes/groups)
 */
function getBoundingRect(items) {
  if (items.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + (item.width || 180));
    maxY = Math.max(maxY, item.y + (item.height || 60));
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Generate a cubic bezier path between two points
 * with smart curvature based on relative positions
 */
function generateBezierPath(x1, y1, x2, y2, sourcePort, targetPort) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const curvature = Math.min(Math.max(dx * 0.4, 50), 200);

  let cx1, cy1, cx2, cy2;

  // Determine control points based on port directions
  switch (sourcePort) {
    case 'right':
      cx1 = x1 + curvature;
      cy1 = y1;
      break;
    case 'left':
      cx1 = x1 - curvature;
      cy1 = y1;
      break;
    case 'bottom':
      cx1 = x1;
      cy1 = y1 + curvature;
      break;
    case 'top':
      cx1 = x1;
      cy1 = y1 - curvature;
      break;
    default:
      cx1 = x1 + curvature;
      cy1 = y1;
  }

  switch (targetPort) {
    case 'left':
      cx2 = x2 - curvature;
      cy2 = y2;
      break;
    case 'right':
      cx2 = x2 + curvature;
      cy2 = y2;
      break;
    case 'top':
      cx2 = x2;
      cy2 = y2 - curvature;
      break;
    case 'bottom':
      cx2 = x2;
      cy2 = y2 + curvature;
      break;
    default:
      cx2 = x2 - curvature;
      cy2 = y2;
  }

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

/**
 * Get the port position (x, y) for a node given the port direction.
 * Always reads the actual rendered height from the DOM so that nodes
 * expanded by attachment images (or any dynamic content) have accurate
 * port positions — no state.height sync required.
 */
function getPortPosition(node, port) {
  const x = node.x;
  const y = node.y;
  const w = node.width || 180;

  // Prefer live DOM height (captures image attachments, wrapping text, etc.)
  let h = node.height || 60;
  if (node.id && typeof Canvas !== 'undefined' && Canvas.nodesLayer) {
    const el = Canvas.nodesLayer.querySelector(`[data-id="${node.id}"]`);
    if (el) h = el.offsetHeight;
  }

  switch (port) {
    case 'top':    return { x: x + w / 2, y: y };
    case 'right':  return { x: x + w, y: y + h / 2 };
    case 'bottom': return { x: x + w / 2, y: y + h };
    case 'left':   return { x: x, y: y + h / 2 };
    default:       return { x: x + w / 2, y: y + h / 2 };
  }
}

/**
 * Find the closest port on a node to a given point
 */
function findClosestPort(node, px, py) {
  const ports = ['top', 'right', 'bottom', 'left'];
  let closest = 'right';
  let minDist = Infinity;

  for (const port of ports) {
    const pos = getPortPosition(node, port);
    const d = distance(px, py, pos.x, pos.y);
    if (d < minDist) {
      minDist = d;
      closest = port;
    }
  }

  return closest;
}

/**
 * Debounce a function
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function
 */
function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Deep clone an object (JSON-safe)
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Convert hex colour to rgba string
 */
function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}

/**
 * Snap value to grid
 */
function snapToGrid(value, gridSize = 20) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Available node colors
 */
const NODE_COLORS = [
  { name: 'Indigo',  value: '#818cf8' },
  { name: 'Violet',  value: '#a78bfa' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Amber',   value: '#fbbf24' },
  { name: 'Rose',    value: '#fb7185' },
  { name: 'Cyan',    value: '#22d3ee' },
  { name: 'Orange',  value: '#fb923c' },
  { name: 'Slate',   value: '#64748b' },
];

/**
 * Status definitions
 */
const STATUSES = [
  { key: null,        label: 'None',        color: 'transparent', icon: '' },
  { key: 'todo',      label: 'Todo',        color: '#94a3b8',     icon: '○' },
  { key: 'progress',  label: 'In Progress', color: '#fb923c',     icon: '◐' },
  { key: 'done',      label: 'Done',        color: '#34d399',     icon: '●' },
  { key: 'blocked',   label: 'Blocked',     color: '#fb7185',     icon: '✕' },
];

/**
 * Get next status in cycle
 */
function cycleStatus(currentStatus) {
  const idx = STATUSES.findIndex(s => s.key === currentStatus);
  const nextIdx = (idx + 1) % STATUSES.length;
  return STATUSES[nextIdx].key;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  let existing = document.getElementById('toast-container');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'toast-container';
    existing.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    document.body.appendChild(existing);
  }

  const toast = document.createElement('div');
  const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#34d399' : type === 'warning' ? '#fb923c' : '#818cf8';
  const icon = type === 'error' ? '✕' : type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ';

  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  toast.textContent = `${icon} ${message}`;
  existing.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* Add slideIn animation */
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
