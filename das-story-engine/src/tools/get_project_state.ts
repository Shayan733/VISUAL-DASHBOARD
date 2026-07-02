import { z } from 'zod';
import type { ToolDef } from './types.js';

export const getProjectState: ToolDef = {
  name: 'get_project_state',
  description:
    '"Where were we?" — compact summary of a project: spine status, phase count, ' +
    'per-scene states, orphan plants, last audit. This is the session memory; ' +
    'call it at the start of any new chat. Pass project_id, or title to look it up.',
  schema: {
    project_id: z.string().max(100).optional(),
    title: z.string().max(300).optional().describe('Look up the project by title if id is unknown'),
  },
  async handler(store, args) {
    let projectId = args.project_id ? String(args.project_id) : null;
    if (!projectId && args.title) {
      const project = await store.findProjectByTitle(String(args.title));
      if (!project) return { error: `No project titled "${args.title}".` };
      projectId = project.id;
    }
    if (!projectId) return { error: 'Pass project_id or title.' };

    const state = await store.getProjectState(projectId);
    if (!state) return { error: `No project with id "${projectId}".` };
    return state;
  },
};
