import { z } from 'zod';
import type { ToolDef } from './types.js';

export const savePhases: ToolDef = {
  name: 'save_phases',
  description:
    'Save all 8 phase one-liners in one call (replaces the previous set for this project).',
  schema: {
    project_id: z.string().min(1),
    phases: z.array(z.object({
      phase_number: z.number().int().min(1).max(8),
      phase_name: z.string().min(1),
      one_liner: z.string().min(1),
    })).length(8).describe('Exactly 8 phases, numbered 1–8'),
  },
  async handler(store, args) {
    const phases = args.phases as Array<{
      phase_number: number; phase_name: string; one_liner: string;
    }>;
    const numbers = new Set(phases.map(p => p.phase_number));
    if (numbers.size !== 8) {
      return { error: 'Phases must be numbered 1–8 with no duplicates.' };
    }
    const saved = await store.savePhases(String(args.project_id), phases);
    return {
      phases_saved: saved.length,
      next_step: 'Call save_plants with the plant/payoff table.',
    };
  },
};
