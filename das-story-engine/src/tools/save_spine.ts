import { z } from 'zod';
import type { ToolDef } from './types.js';

export const saveSpine: ToolDef = {
  name: 'save_spine',
  description:
    'Save the 4-line story spine (want / stakes / hero belief / villain belief). ' +
    'Always writes a NEW version — old spines are never overwritten. ' +
    'Set approved=true only after the founder locks it.',
  schema: {
    project_id: z.string().min(1).max(100),
    want: z.string().min(1).max(2_000).describe('What the hero wants'),
    stakes: z.string().min(1).max(2_000).describe('What happens if they fail'),
    hero_belief: z.string().min(1).max(2_000).describe('The lie/belief the hero starts with'),
    villain_belief: z.string().min(1).max(2_000).describe('The belief the villain embodies'),
    approved: z.boolean().default(false).describe('Founder approval flag'),
  },
  async handler(store, args) {
    const spine = await store.saveSpine(String(args.project_id), {
      want: String(args.want),
      stakes: String(args.stakes),
      hero_belief: String(args.hero_belief),
      villain_belief: String(args.villain_belief),
      approved: Boolean(args.approved),
    });
    return {
      spine_version: spine.version,
      approved: spine.approved,
      next_step: spine.approved
        ? 'Spine locked. Call save_phases with the 8 phase one-liners.'
        : 'Iterate with the founder, then save again with approved=true to lock.',
    };
  },
};
