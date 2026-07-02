import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Store } from '../db/index.js';
import { ALL_TOOLS, asContent } from '../tools/index.js';

/** Build an MCP server with every pipeline tool registered against a store. */
export function buildMcpServer(store: Store): McpServer {
  const server = new McpServer({
    name: 'das-story-engine',
    version: '0.1.0',
  });

  for (const tool of ALL_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(store, args ?? {});
          return asContent(result);
        } catch (e) {
          // Tools should return {error} for expected failures; this catches
          // the unexpected ones without killing the request.
          const message = e instanceof Error ? e.message : String(e);
          return asContent({ error: `${tool.name} failed: ${message}` });
        }
      },
    );
  }

  return server;
}
