import type { ZodRawShape } from 'zod';
import type { Store } from '../db/index.js';

/** One MCP tool = one file exporting one ToolDef. */
export interface ToolDef {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler: (store: Store, args: Record<string, unknown>) => Promise<unknown>;
}

/** Wrap a tool result as MCP text content. */
export function asContent(result: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
