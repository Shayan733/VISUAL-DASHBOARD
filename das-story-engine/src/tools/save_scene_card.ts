import { z } from 'zod';
import type { ToolDef } from './types.js';

export const saveSceneCard: ToolDef = {
  name: 'save_scene_card',
  description:
    'Save a scene card: who / want / block / turn (no prose yet). ' +
    'A card with an empty turn is REFUSED — a scene that does not turn is not a scene. ' +
    'Saving again for the same scene number writes a new version.',
  schema: {
    project_id: z.string().min(1).max(100),
    scene_number: z.number().int().min(1).max(10_000),
    location: z.string().max(500).optional(),
    who: z.string().min(1).max(2_000).describe('Who is in the scene'),
    want: z.string().min(1).max(2_000).describe('What they want in this scene'),
    block: z.string().min(1).max(2_000).describe('What blocks them'),
    turn: z.string().max(2_000).describe('How the scene turns — MANDATORY, empty is refused'),
    plant_ref: z.string().max(100).optional().describe('Optional plant id this scene plants/pays'),
  },
  async handler(store, args) {
    const turn = String(args.turn ?? '').trim();
    if (!turn) {
      return {
        error: 'Scene card refused: the "turn" field is empty. ' +
          'Every scene must turn — state what changes by the end of the scene.',
      };
    }
    const scene = await store.saveSceneCard(String(args.project_id), {
      scene_number: Number(args.scene_number),
      location: args.location ? String(args.location) : '',
      who: String(args.who),
      want: String(args.want),
      block: String(args.block),
      turn,
      plant_ref: args.plant_ref ? String(args.plant_ref) : null,
    });
    return {
      scene_number: scene.scene_number,
      version: scene.version,
      state: scene.state,
      next_step: 'Write prose for this card, then call save_scene_prose.',
    };
  },
};
