import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/db/memory.js';
import { ALL_TOOLS } from '../src/tools/index.js';
import type { ToolDef } from '../src/tools/types.js';

const tool = (name: string): ToolDef => {
  const t = ALL_TOOLS.find(t => t.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
};

let store: MemoryStore;
let projectId: string;

beforeEach(async () => {
  store = new MemoryStore();
  const res = await tool('create_project').handler(store, {
    title: 'Rooftop', brief_text: 'Replication brief.',
  }) as { project_id: string };
  projectId = res.project_id;
});

describe('the full pipeline', () => {
  it('runs create → spine → phases → plants → card → prose → approve → state', async () => {
    const spine = await tool('save_spine').handler(store, {
      project_id: projectId,
      want: 'w', stakes: 's', hero_belief: 'h', villain_belief: 'v', approved: true,
    }) as { spine_version: number; approved: boolean };
    expect(spine.spine_version).toBe(1);
    expect(spine.approved).toBe(true);

    const phases = await tool('save_phases').handler(store, {
      project_id: projectId,
      phases: Array.from({ length: 8 }, (_, i) => ({
        phase_number: i + 1, phase_name: `Phase ${i + 1}`, one_liner: 'beat',
      })),
    }) as { phases_saved: number };
    expect(phases.phases_saved).toBe(8);

    const plants = await tool('save_plants').handler(store, {
      project_id: projectId,
      plants: [
        { plant_text: 'the locked drawer', planted_scene: 1, payoff_scene: 4, payoff_text: 'opened' },
        { plant_text: 'the missing photo', planted_scene: 2 },
      ],
    }) as { plants_saved: number; orphans: number };
    expect(plants.plants_saved).toBe(2);
    expect(plants.orphans).toBe(1);

    const card = await tool('save_scene_card').handler(store, {
      project_id: projectId, scene_number: 1, location: 'Rooftop',
      who: 'Hero, Rival', want: 'the truth', block: 'the lie', turn: 'the photo is found',
    }) as { version: number; state: string };
    expect(card.version).toBe(1);
    expect(card.state).toBe('draft');

    const prose = await tool('save_scene_prose').handler(store, {
      project_id: projectId, scene_number: 1, prose: 'EXT. ROOFTOP — NIGHT ...',
    }) as { version: number };
    expect(prose.version).toBe(2);

    const approved = await tool('approve_scene').handler(store, {
      project_id: projectId, scene_number: 1,
    }) as { state: string };
    expect(approved.state).toBe('approved');

    const state = await tool('get_project_state').handler(store, {
      project_id: projectId,
    }) as any;
    expect(state.spine).toEqual({ version: 1, approved: true });
    expect(state.phases_saved).toBe(8);
    expect(state.plants.orphans).toBe(1);
    expect(state.scenes[0]).toMatchObject({
      scene_number: 1, state: 'approved', has_prose: true,
    });
  });
});

describe('guardrails', () => {
  it('refuses a scene card with an empty turn', async () => {
    for (const turn of ['', '   ', '\n']) {
      const res = await tool('save_scene_card').handler(store, {
        project_id: projectId, scene_number: 1,
        who: 'A', want: 'w', block: 'b', turn,
      }) as { error?: string };
      expect(res.error).toMatch(/turn/i);
    }
    // Nothing was saved
    expect(await store.latestScenes(projectId)).toHaveLength(0);
  });

  it('refuses approving a scene without prose', async () => {
    await tool('save_scene_card').handler(store, {
      project_id: projectId, scene_number: 1,
      who: 'A', want: 'w', block: 'b', turn: 't',
    });
    const res = await tool('approve_scene').handler(store, {
      project_id: projectId, scene_number: 1,
    }) as { error?: string };
    expect(res.error).toMatch(/no prose/i);
  });

  it('refuses prose for a scene with no card', async () => {
    const res = await tool('save_scene_prose').handler(store, {
      project_id: projectId, scene_number: 42, prose: 'x',
    }) as { error?: string };
    expect(res.error).toMatch(/no card/i);
  });

  it('rejects duplicate phase numbers', async () => {
    const res = await tool('save_phases').handler(store, {
      project_id: projectId,
      phases: Array.from({ length: 8 }, () => ({
        phase_number: 1, phase_name: 'dup', one_liner: 'x',
      })),
    }) as { error?: string };
    expect(res.error).toMatch(/no duplicates/i);
  });

  it('get_project_state resolves by title and reports unknowns', async () => {
    const byTitle = await tool('get_project_state').handler(store, {
      title: 'rooftop',
    }) as any;
    expect(byTitle.project.title).toBe('Rooftop');

    const unknown = await tool('get_project_state').handler(store, {
      title: 'does-not-exist',
    }) as { error?: string };
    expect(unknown.error).toBeTruthy();

    const noArgs = await tool('get_project_state').handler(store, {}) as { error?: string };
    expect(noArgs.error).toMatch(/project_id or title/);
  });
});
