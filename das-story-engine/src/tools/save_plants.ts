import { z } from 'zod';
import type { ToolDef } from './types.js';

export const savePlants: ToolDef = {
  name: 'save_plants',
  description:
    'Save the plant/payoff table (replaces the previous table for this project). ' +
    'A plant without a payoff_scene stays status "orphan" — the audit will catch it.',
  schema: {
    project_id: z.string().min(1),
    plants: z.array(z.object({
      plant_text: z.string().min(1).describe('What is planted'),
      planted_scene: z.number().int().min(1).describe('Scene number where it is planted'),
      payoff_text: z.string().optional().describe('How it pays off (omit if not yet decided)'),
      payoff_scene: z.number().int().min(1).optional().describe('Scene number where it pays off'),
    })).min(1),
  },
  async handler(store, args) {
    const plants = args.plants as Array<{
      plant_text: string; planted_scene: number;
      payoff_text?: string; payoff_scene?: number;
    }>;
    const saved = await store.savePlants(String(args.project_id), plants);
    const orphans = saved.filter(p => p.status === 'orphan');
    return {
      plants_saved: saved.length,
      orphans: orphans.length,
      orphan_plants: orphans.map(p => p.plant_text),
      next_step: 'Call save_scene_card for each scene (who / want / block / turn).',
    };
  },
};
