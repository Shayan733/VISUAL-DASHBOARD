/* Local MCP server — streamable HTTP transport with bearer-token auth.
   Run: npm run dev  →  http://localhost:8787/mcp                      */

import { readFileSync, existsSync } from 'node:fs';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createStore } from '../db/index.js';
import { buildMcpServer } from './mcp.js';

/* Minimal .env loader — no dotenv dependency needed. */
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.DSE_BEARER_TOKEN;

if (!TOKEN || TOKEN === 'change-me') {
  console.error(
    'Refusing to start: set DSE_BEARER_TOKEN in .env to a real secret ' +
    '(copy .env.example and edit it).',
  );
  process.exit(1);
}

const store = createStore();
const usingSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(express.json({ limit: '4mb' }));

/* Auth gate — rejected BEFORE any tool code runs. */
app.use('/mcp', (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided !== TOKEN) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized: missing or invalid bearer token' },
      id: null,
    });
    return;
  }
  next();
});

/* Stateless streamable HTTP: fresh server+transport per request, so no
   session bookkeeping is needed and any chat surface can reconnect. */
app.post('/mcp', async (req, res) => {
  try {
    const server = buildMcpServer(store);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('MCP request error:', e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

/* Stateless mode has nothing to GET/DELETE. */
app.get('/mcp', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed in stateless mode' },
    id: null,
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, store: usingSupabase ? 'supabase' : 'memory' });
});

app.listen(PORT, () => {
  console.log(`Das Story Engine MCP server → http://localhost:${PORT}/mcp`);
  console.log(`Store: ${usingSupabase ? 'Supabase (live)' : 'MemoryStore (.data/store.json)'}`);
});
