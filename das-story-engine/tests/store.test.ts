import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/db/memory.js';
import { StoreError } from '../src/db/store.js';

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore(); // no file path → pure in-memory for tests
});

describe('projects', () => {
  it('creates and reads back a project', async () => {
    const p = await store.createProject('Rooftop', 'A brief.');
    expect(p.id).toBeTruthy();
    expect(p.status).toBe('active');
    expect(await store.getProject(p.id)).toEqual(p);
  });

  it('finds a project by title, case-insensitive', async () => {
    const p = await store.createProject('Rooftop', '');
    expect((await store.findProjectByTitle('rooftop'))?.id).toBe(p.id);
    expect(await store.findProjectByTitle('nope')).toBeNull();
  });
});

describe('spines', () => {
  it('versions spines append-only, never overwriting', async () => {
    const p = await store.createProject('T', '');
    const spine = { want: 'w', stakes: 's', hero_belief: 'h', villain_belief: 'v' };
    const v1 = await store.saveSpine(p.id, { ...spine, approved: false });
    const v2 = await store.saveSpine(p.id, { ...spine, want: 'w2', approved: true });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    const latest = await store.latestSpine(p.id);
    expect(latest?.version).toBe(2);
    expect(latest?.want).toBe('w2');
    expect(latest?.approved).toBe(true);
  });

  it('throws for an unknown project', async () => {
    await expect(store.saveSpine('ghost', {
      want: 'w', stakes: 's', hero_belief: 'h', villain_belief: 'v', approved: false,
    })).rejects.toThrow(StoreError);
  });
});

describe('phases and plants', () => {
  it('replaces the phase set on re-save', async () => {
    const p = await store.createProject('T', '');
    const mk = (n: number) => ({ phase_number: n, phase_name: `P${n}`, one_liner: `L${n}` });
    await store.savePhases(p.id, [1, 2, 3].map(mk));
    await store.savePhases(p.id, [1, 2].map(mk));
    expect(await store.listPhases(p.id)).toHaveLength(2);
  });

  it('marks plants orphan until a payoff scene is set', async () => {
    const p = await store.createProject('T', '');
    const plants = await store.savePlants(p.id, [
      { plant_text: 'gun on the wall', planted_scene: 1, payoff_scene: 5, payoff_text: 'fired' },
      { plant_text: 'unexplained key', planted_scene: 2 },
    ]);
    expect(plants[0].status).toBe('paid');
    expect(plants[1].status).toBe('orphan');
  });
});

describe('scenes', () => {
  it('cards version up; prose creates a new draft version', async () => {
    const p = await store.createProject('T', '');
    const card = { scene_number: 1, who: 'A', want: 'w', block: 'b', turn: 't' };
    const v1 = await store.saveSceneCard(p.id, card);
    expect(v1.version).toBe(1);
    expect(v1.state).toBe('draft');
    expect(v1.prose_text).toBeNull();

    const v2 = await store.saveSceneProse(p.id, 1, 'INT. ROOF — NIGHT');
    expect(v2.version).toBe(2);
    expect(v2.prose_text).toContain('ROOF');
    expect(v2.state).toBe('draft');

    // Old version untouched (append-only)
    const latest = await store.latestScenes(p.id);
    expect(latest).toHaveLength(1);
    expect(latest[0].version).toBe(2);
  });

  it('refuses prose for a scene with no card', async () => {
    const p = await store.createProject('T', '');
    await expect(store.saveSceneProse(p.id, 9, 'x')).rejects.toThrow(/no card yet/);
  });

  it('approve flips draft → approved; new prose re-enters draft', async () => {
    const p = await store.createProject('T', '');
    await store.saveSceneCard(p.id, { scene_number: 1, who: 'A', want: 'w', block: 'b', turn: 't' });
    await store.saveSceneProse(p.id, 1, 'prose');
    const approved = await store.setSceneState(p.id, 1, 'approved');
    expect(approved.state).toBe('approved');

    const redraft = await store.saveSceneProse(p.id, 1, 'better prose');
    expect(redraft.state).toBe('draft');
    expect(redraft.version).toBe(3);
  });
});

describe('audits and project state', () => {
  it('numbers audit runs and reports the last one in state', async () => {
    const p = await store.createProject('T', 'brief text here');
    await store.saveAudit(p.id, 'fail', ['orphan plant: key']);
    await store.saveAudit(p.id, 'pass', []);
    const audit = await store.latestAudit(p.id);
    expect(audit?.run_number).toBe(2);
    expect(audit?.result).toBe('pass');
  });

  it('returns the compact session-memory summary', async () => {
    const p = await store.createProject('Rooftop', 'A'.repeat(500));
    await store.saveSpine(p.id, {
      want: 'w', stakes: 's', hero_belief: 'h', villain_belief: 'v', approved: true,
    });
    await store.savePhases(p.id, Array.from({ length: 8 }, (_, i) => ({
      phase_number: i + 1, phase_name: `P${i + 1}`, one_liner: 'x',
    })));
    await store.savePlants(p.id, [{ plant_text: 'key', planted_scene: 1 }]);
    await store.saveSceneCard(p.id, { scene_number: 1, who: 'A', want: 'w', block: 'b', turn: 't' });

    const state = await store.getProjectState(p.id);
    expect(state?.project.brief_preview.length).toBeLessThanOrEqual(200); // compact by design
    expect(state?.spine).toEqual({ version: 1, approved: true });
    expect(state?.phases_saved).toBe(8);
    expect(state?.plants).toEqual({ total: 1, orphans: 1 });
    expect(state?.scenes).toEqual([
      { scene_number: 1, state: 'draft', version: 1, has_prose: false, location: '' },
    ]);
    expect(state?.last_audit).toBeNull();
  });
});

describe('file persistence', () => {
  it('survives a restart when given a file path', async () => {
    const file = `.data/test-${Date.now()}.json`;
    const a = new MemoryStore(file);
    const p = await a.createProject('Persisted', '');
    const b = new MemoryStore(file);
    expect((await b.getProject(p.id))?.title).toBe('Persisted');
  });
});
