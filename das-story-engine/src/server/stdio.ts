/* Stdio entry — for running the engine directly inside a desktop MCP
   client (e.g. Claude Desktop). No HTTP, no bearer token: the client
   launches this process and talks over stdin/stdout, so the OS process
   boundary is the trust boundary.

   Run:   npm run stdio
   Uses the same tools + store as the HTTP server (src/server/index.ts). */

import { readFileSync, existsSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStore } from '../db/index.js';
import { buildMcpServer } from './mcp.js';

/* Minimal .env loader — same as the HTTP server. */
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvFile();

async function main() {
  const store = createStore();
  const server = buildMcpServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // IMPORTANT: never write to stdout here — it is the MCP channel.
  // Diagnostics go to stderr only.
  console.error('Das Story Engine (stdio) ready.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
