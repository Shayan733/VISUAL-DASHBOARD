import { z } from 'zod';
import type { ToolDef } from './types.js';

export const createProject: ToolDef = {
  name: 'create_project',
  description:
    'Start a new story project from a title and a replication brief. ' +
    'Returns the project id — use it in every later call.',
  schema: {
    title: z.string().min(1).describe('Working title of the story'),
    brief_text: z.string().default('').describe('The replication brief the story starts from'),
  },
  async handler(store, args) {
    const project = await store.createProject(
      String(args.title),
      String(args.brief_text ?? ''),
    );
    return {
      project_id: project.id,
      title: project.title,
      status: project.status,
      next_step: 'Write the spine with the founder, then call save_spine.',
    };
  },
};
