import { z } from 'zod';
import type { ToolDef } from './types.js';
import { StoreError } from '../db/index.js';

export const saveSceneProse: ToolDef = {
  name: 'save_scene_prose',
  description:
    'Attach prose to an existing scene card as a NEW version (old drafts are kept). ' +
    'The scene state moves to "draft" — the founder approves it with approve_scene.',
  schema: {
    project_id: z.string().min(1).max(100),
    scene_number: z.number().int().min(1).max(10_000),
    prose: z.string().min(1).max(200_000).describe('The scene prose — action in English, dialogue in Romanised Hindi'),
  },
  async handler(store, args) {
    try {
      const scene = await store.saveSceneProse(
        String(args.project_id),
        Number(args.scene_number),
        String(args.prose),
      );
      return {
        scene_number: scene.scene_number,
        version: scene.version,
        state: scene.state,
        next_step: 'Founder reviews; call approve_scene when it is locked.',
      };
    } catch (e) {
      if (e instanceof StoreError) return { error: e.message };
      throw e;
    }
  },
};
