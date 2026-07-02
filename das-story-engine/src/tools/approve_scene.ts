import { z } from 'zod';
import type { ToolDef } from './types.js';
import { StoreError } from '../db/index.js';

export const approveScene: ToolDef = {
  name: 'approve_scene',
  description:
    'Founder-only: flip a scene from draft to approved. ' +
    'Refused if the scene has no prose yet.',
  schema: {
    project_id: z.string().min(1).max(100),
    scene_number: z.number().int().min(1).max(10_000),
  },
  async handler(store, args) {
    const projectId = String(args.project_id);
    const sceneNumber = Number(args.scene_number);
    try {
      const scenes = await store.latestScenes(projectId);
      const scene = scenes.find(s => s.scene_number === sceneNumber);
      if (!scene) return { error: `Scene ${sceneNumber} does not exist.` };
      if (!scene.prose_text) {
        return { error: `Scene ${sceneNumber} has no prose yet — approve after save_scene_prose.` };
      }
      const updated = await store.setSceneState(projectId, sceneNumber, 'approved');
      return {
        scene_number: updated.scene_number,
        state: updated.state,
        version: updated.version,
      };
    } catch (e) {
      if (e instanceof StoreError) return { error: e.message };
      throw e;
    }
  },
};
