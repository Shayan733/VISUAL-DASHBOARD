const js = require('@eslint/js');

// Every module in js/ is an IIFE that exposes a global. Declaring them
// here lets ESLint catch dead references (like the old SupabaseClient).
const appGlobals = {
  // Browser
  window: 'readonly', document: 'readonly', localStorage: 'readonly',
  fetch: 'readonly', console: 'readonly', navigator: 'readonly',
  requestAnimationFrame: 'readonly', setTimeout: 'readonly',
  setInterval: 'readonly', clearTimeout: 'readonly', clearInterval: 'readonly',
  URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly',
  Image: 'readonly', Event: 'readonly', FormData: 'readonly',
  FileReader: 'readonly', DOMParser: 'readonly', ResizeObserver: 'readonly',
  AbortSignal: 'readonly', atob: 'readonly', btoa: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
  module: 'writable',
  // Third-party
  firebase: 'readonly', html2canvas: 'readonly',
  // App modules (one global per file)
  FIREBASE_CONFIG: 'readonly', FirebaseAuth: 'readonly', FirestoreDB: 'readonly',
  FileStorage: 'readonly', Sync: 'readonly', Sanitize: 'readonly',
  Canvas: 'readonly', History: 'readonly', State: 'readonly',
  NodeRenderer: 'readonly', Selection: 'readonly', ConnectionRenderer: 'readonly',
  Drag: 'readonly', Toolbar: 'readonly', ContextMenu: 'readonly',
  Properties: 'readonly', Keyboard: 'readonly', Minimap: 'readonly',
  CommandPalette: 'readonly', Sidebar: 'readonly', Attachments: 'readonly',
  WelcomeModal: 'readonly', App: 'readonly',
  // Shared utils (utils.js / sanitize.js / sidebar.js)
  generateId: 'readonly', clamp: 'readonly', lerp: 'readonly',
  distance: 'readonly', pointInRect: 'readonly', rectsOverlap: 'readonly',
  getBoundingRect: 'readonly', generateBezierPath: 'readonly',
  getPortPosition: 'readonly', findClosestPort: 'readonly',
  debounce: 'readonly', throttle: 'readonly', deepClone: 'readonly',
  hexToRgba: 'readonly', snapToGrid: 'readonly', NODE_COLORS: 'readonly',
  STATUSES: 'readonly', cycleStatus: 'readonly', showToast: 'readonly',
  escapeHtml: 'readonly', getTimeAgo: 'readonly',
};

module.exports = [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: appGlobals,
    },
    rules: {
      // Each file defines one of the declared globals — redeclare/unused
      // are expected here. The rule that matters is no-undef: it catches
      // dead references (e.g. the old SupabaseClient leftover).
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
