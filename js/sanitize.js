/* ============================================
   Sanitize — escaping, value sanitizers, and
   state validation for every data entry point
   (Firestore load, share link, JSON import,
   templates, snapshot restore).
   Loaded BEFORE all other app scripts.
   ============================================ */

const Sanitize = (() => {

  const DEFAULT_COLOR = '#818cf8';
  const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
  const BARE_HEX_RE = /^[0-9a-fA-F]{3,8}$/;
  const MAX_NODES = 5000;
  const MAX_CONNECTIONS = 10000;
  const NODE_TYPES = ['node', 'group', 'sticky'];
  const PORTS = ['top', 'right', 'bottom', 'left'];
  const STATUS_ALIASES = { 'in-progress': 'progress', 'inprogress': 'progress' };
  const VALID_STATUSES = [null, 'todo', 'progress', 'done', 'blocked'];

  /**
   * Escape a string for safe interpolation into HTML —
   * both text content and attribute values.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Only allow #hex colors; anything else falls back.
   * Bare hex ("818cf8") gets a # prefix (legacy data).
   */
  function sanitizeColor(value, fallback = DEFAULT_COLOR) {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (HEX_COLOR_RE.test(v)) return v;
    if (BARE_HEX_RE.test(v)) return '#' + v;
    return fallback;
  }

  /**
   * Only allow http/https URLs. Returns null for anything else
   * (javascript:, data:, malformed).
   */
  function sanitizeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim());
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch { /* fall through */ }
    return null;
  }

  /* ── internal coercers ── */

  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const str = (v, d = '') => (typeof v === 'string') ? v : d;
  const bool = (v, d = false) => (typeof v === 'boolean') ? v : d;

  function sanitizeStatus(value) {
    if (value === null || value === undefined) return null;
    const mapped = STATUS_ALIASES[value] || value;
    return VALID_STATUSES.includes(mapped) ? mapped : null;
  }

  function sanitizeAttachment(att) {
    if (!att || typeof att !== 'object') return null;
    const url = sanitizeUrl(att.url);
    return {
      id: str(att.id, ''),
      name: str(att.name, 'Attachment'),
      attachmentType: str(att.attachmentType, 'file'),
      mimeType: att.mimeType === null ? null : str(att.mimeType, null),
      size: att.size === null ? null : num(att.size, null),
      storagePath: att.storagePath === null ? null : str(att.storagePath, null),
      url,
      ogTitle: att.ogTitle ? str(att.ogTitle) : null,
      ogImage: sanitizeUrl(att.ogImage),
      uploadedAt: str(att.uploadedAt, ''),
    };
  }

  function sanitizeNode(node, forcedType) {
    if (!node || typeof node !== 'object') return null;
    const type = forcedType || (NODE_TYPES.includes(node.type) ? node.type : 'node');
    const out = {
      id: str(node.id) || `node_${Math.random().toString(36).slice(2, 10)}`,
      type,
      label: str(node.label, type === 'sticky' ? 'Note' : 'Untitled'),
      description: str(node.description, ''),
      x: num(node.x, 0),
      y: num(node.y, 0),
      width: num(node.width, type === 'group' ? 400 : 180),
      height: num(node.height, type === 'group' ? 300 : 60),
      color: sanitizeColor(node.color, type === 'sticky' ? '#fbbf24' : DEFAULT_COLOR),
      status: sanitizeStatus(node.status),
      parentId: node.parentId ? str(node.parentId) : null,
      collapsed: bool(node.collapsed, false),
      attachments: Array.isArray(node.attachments)
        ? node.attachments.map(sanitizeAttachment).filter(Boolean)
        : [],
    };
    if (node.owner) out.owner = str(node.owner);
    if (node.dueDate) out.dueDate = str(node.dueDate);
    if (node.portLabels && typeof node.portLabels === 'object') {
      out.portLabels = {};
      PORTS.forEach(p => {
        if (typeof node.portLabels[p] === 'string') out.portLabels[p] = node.portLabels[p];
      });
    }
    return out;
  }

  function sanitizeConnection(conn, nodeIds) {
    if (!conn || typeof conn !== 'object') return null;
    const sourceId = str(conn.sourceId);
    const targetId = str(conn.targetId);
    if (!sourceId || !targetId || sourceId === targetId) return null;
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return null;
    return {
      id: str(conn.id) || `conn_${Math.random().toString(36).slice(2, 10)}`,
      sourceId,
      targetId,
      sourcePort: PORTS.includes(conn.sourcePort) ? conn.sourcePort : 'right',
      targetPort: PORTS.includes(conn.targetPort) ? conn.targetPort : 'left',
      label: str(conn.label, ''),
      animated: bool(conn.animated, true),
    };
  }

  /**
   * Validate + normalize a full state object. Never throws.
   * Also migrates the legacy template schema:
   *   - top-level groups[] → nodes with type 'group'
   *   - node.groupId → parentId (x/y converted to parent-relative)
   *   - missing node.type → 'node'
   *   - bare hex colors → '#'-prefixed
   *   - status 'in-progress' → 'progress'
   */
  function validateState(raw) {
    const empty = {
      canvas: { offsetX: 0, offsetY: 0, zoom: 1 },
      nodes: [],
      connections: [],
    };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;

    const canvas = raw.canvas && typeof raw.canvas === 'object'
      ? {
          offsetX: num(raw.canvas.offsetX, 0),
          offsetY: num(raw.canvas.offsetY, 0),
          zoom: Math.min(Math.max(num(raw.canvas.zoom, 1), 0.1), 5),
        }
      : { offsetX: 0, offsetY: 0, zoom: 1 };

    // Legacy: groups in a separate top-level array
    const legacyGroups = Array.isArray(raw.groups)
      ? raw.groups.map(g => sanitizeNode(g, 'group')).filter(Boolean)
      : [];
    const groupById = {};
    legacyGroups.forEach(g => { groupById[g.id] = g; });

    const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
    const nodes = [];
    legacyGroups.forEach(g => nodes.push(g));

    rawNodes.slice(0, MAX_NODES).forEach(n => {
      const clean = sanitizeNode(n);
      if (!clean) return;
      // Legacy groupId → parentId with absolute → parent-relative coords
      if (n && typeof n === 'object' && n.groupId && !clean.parentId) {
        const parent = groupById[n.groupId];
        if (parent) {
          clean.parentId = parent.id;
          clean.x -= parent.x;
          clean.y -= parent.y;
        }
      }
      nodes.push(clean);
    });

    // Drop parent references to nodes that don't exist
    const nodeIds = new Set(nodes.map(n => n.id));
    nodes.forEach(n => {
      if (n.parentId && !nodeIds.has(n.parentId)) n.parentId = null;
    });

    const rawConns = Array.isArray(raw.connections) ? raw.connections : [];
    const connections = rawConns
      .slice(0, MAX_CONNECTIONS)
      .map(c => sanitizeConnection(c, nodeIds))
      .filter(Boolean);

    return { canvas, nodes, connections };
  }

  return { escapeHtml, sanitizeColor, sanitizeUrl, validateState };
})();

/* Global canonical escaper — replaces the per-module copies. */
function escapeHtml(text) {
  return Sanitize.escapeHtml(text);
}

/* Allow direct import in Vitest without ESM conversion. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Sanitize, escapeHtml };
}
