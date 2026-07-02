import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Project, Spine, Phase, Plant, Scene, Audit, ProjectState, SceneState,
} from '../types/index.js';
import { Store, StoreError } from './store.js';

/**
 * Real Postgres store. ONLY constructed when both SUPABASE_URL and
 * SUPABASE_SERVICE_KEY are set (see createStore in index.ts) — never
 * used in local/mock runs.
 */
export class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private fail(op: string, error: { message: string } | null): never {
    throw new StoreError(`${op} failed: ${error?.message ?? 'unknown error'}`);
  }

  /* ── projects ── */

  async createProject(title: string, briefText: string): Promise<Project> {
    const { data, error } = await this.client
      .from('projects')
      .insert({ title, brief_text: briefText })
      .select()
      .single();
    if (error || !data) this.fail('create_project', error);
    return data as Project;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const { data } = await this.client
      .from('projects').select().eq('id', projectId).maybeSingle();
    return (data as Project) ?? null;
  }

  async findProjectByTitle(title: string): Promise<Project | null> {
    const { data } = await this.client
      .from('projects').select().ilike('title', title.trim()).limit(1).maybeSingle();
    return (data as Project) ?? null;
  }

  /* ── spines ── */

  async saveSpine(projectId: string, spine: {
    want: string; stakes: string; hero_belief: string; villain_belief: string;
    approved: boolean;
  }): Promise<Spine> {
    const latest = await this.latestSpine(projectId);
    const { data, error } = await this.client
      .from('spines')
      .insert({ project_id: projectId, version: (latest?.version ?? 0) + 1, ...spine })
      .select()
      .single();
    if (error || !data) this.fail('save_spine', error);
    return data as Spine;
  }

  async latestSpine(projectId: string): Promise<Spine | null> {
    const { data } = await this.client
      .from('spines').select().eq('project_id', projectId)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    return (data as Spine) ?? null;
  }

  /* ── phases ── */

  async savePhases(projectId: string, phases: Array<{
    phase_number: number; phase_name: string; one_liner: string;
  }>): Promise<Phase[]> {
    await this.client.from('phases').delete().eq('project_id', projectId);
    const { data, error } = await this.client
      .from('phases')
      .insert(phases.map(p => ({ project_id: projectId, ...p })))
      .select();
    if (error || !data) this.fail('save_phases', error);
    return data as Phase[];
  }

  async listPhases(projectId: string): Promise<Phase[]> {
    const { data } = await this.client
      .from('phases').select().eq('project_id', projectId)
      .order('phase_number', { ascending: true });
    return (data as Phase[]) ?? [];
  }

  /* ── plants ── */

  async savePlants(projectId: string, plants: Array<{
    plant_text: string; planted_scene: number;
    payoff_text?: string | null; payoff_scene?: number | null;
  }>): Promise<Plant[]> {
    await this.client.from('plants').delete().eq('project_id', projectId);
    const { data, error } = await this.client
      .from('plants')
      .insert(plants.map(p => ({
        project_id: projectId,
        plant_text: p.plant_text,
        planted_scene: p.planted_scene,
        payoff_text: p.payoff_text ?? null,
        payoff_scene: p.payoff_scene ?? null,
        status: p.payoff_scene != null ? 'paid' : 'orphan',
      })))
      .select();
    if (error || !data) this.fail('save_plants', error);
    return data as Plant[];
  }

  async listPlants(projectId: string): Promise<Plant[]> {
    const { data } = await this.client
      .from('plants').select().eq('project_id', projectId);
    return (data as Plant[]) ?? [];
  }

  /* ── scenes ── */

  private async latestSceneVersion(projectId: string, sceneNumber: number): Promise<Scene | null> {
    const { data } = await this.client
      .from('scenes').select()
      .eq('project_id', projectId).eq('scene_number', sceneNumber)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    return (data as Scene) ?? null;
  }

  async saveSceneCard(projectId: string, card: {
    scene_number: number; location?: string;
    who: string; want: string; block: string; turn: string;
    plant_ref?: string | null;
  }): Promise<Scene> {
    const prior = await this.latestSceneVersion(projectId, card.scene_number);
    const { data, error } = await this.client
      .from('scenes')
      .insert({
        project_id: projectId,
        scene_number: card.scene_number,
        location: card.location ?? '',
        who: card.who,
        want: card.want,
        block: card.block,
        turn: card.turn,
        plant_ref: card.plant_ref ?? null,
        prose_text: null,
        state: 'draft',
        version: (prior?.version ?? 0) + 1,
      })
      .select()
      .single();
    if (error || !data) this.fail('save_scene_card', error);
    return data as Scene;
  }

  async saveSceneProse(projectId: string, sceneNumber: number, prose: string): Promise<Scene> {
    const prior = await this.latestSceneVersion(projectId, sceneNumber);
    if (!prior) {
      throw new StoreError(`Scene ${sceneNumber} has no card yet. Call save_scene_card first.`);
    }
    const { id: _id, created_at: _ts, ...rest } = prior;
    const { data, error } = await this.client
      .from('scenes')
      .insert({ ...rest, prose_text: prose, state: 'draft', version: prior.version + 1 })
      .select()
      .single();
    if (error || !data) this.fail('save_scene_prose', error);
    return data as Scene;
  }

  async setSceneState(projectId: string, sceneNumber: number, state: SceneState): Promise<Scene> {
    const scene = await this.latestSceneVersion(projectId, sceneNumber);
    if (!scene) throw new StoreError(`Scene ${sceneNumber} does not exist.`);
    const { data, error } = await this.client
      .from('scenes').update({ state }).eq('id', scene.id).select().single();
    if (error || !data) this.fail('set_scene_state', error);
    return data as Scene;
  }

  async latestScenes(projectId: string): Promise<Scene[]> {
    const { data } = await this.client
      .from('scenes').select().eq('project_id', projectId)
      .order('scene_number', { ascending: true })
      .order('version', { ascending: false });
    const byNumber = new Map<number, Scene>();
    for (const s of (data as Scene[]) ?? []) {
      if (!byNumber.has(s.scene_number)) byNumber.set(s.scene_number, s);
    }
    return [...byNumber.values()];
  }

  /* ── audits ── */

  async saveAudit(projectId: string, result: 'pass' | 'fail', failures: string[]): Promise<Audit> {
    const latest = await this.latestAudit(projectId);
    const { data, error } = await this.client
      .from('audits')
      .insert({
        project_id: projectId,
        run_number: (latest?.run_number ?? 0) + 1,
        result,
        failures_json: failures,
      })
      .select()
      .single();
    if (error || !data) this.fail('save_audit', error);
    return data as Audit;
  }

  async latestAudit(projectId: string): Promise<Audit | null> {
    const { data } = await this.client
      .from('audits').select().eq('project_id', projectId)
      .order('run_number', { ascending: false }).limit(1).maybeSingle();
    return (data as Audit) ?? null;
  }

  /* ── the session memory ── */

  async getProjectState(projectId: string): Promise<ProjectState | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    const [spine, phases, plants, scenes, audit] = await Promise.all([
      this.latestSpine(projectId),
      this.listPhases(projectId),
      this.listPlants(projectId),
      this.latestScenes(projectId),
      this.latestAudit(projectId),
    ]);

    return {
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        brief_preview: project.brief_text.slice(0, 200),
      },
      spine: spine ? { version: spine.version, approved: spine.approved } : null,
      phases_saved: phases.length,
      plants: {
        total: plants.length,
        orphans: plants.filter(p => p.status === 'orphan').length,
      },
      scenes: scenes.map(s => ({
        scene_number: s.scene_number,
        state: s.state,
        version: s.version,
        has_prose: s.prose_text != null,
        location: s.location,
      })),
      last_audit: audit
        ? { run_number: audit.run_number, result: audit.result, failures: audit.failures_json }
        : null,
    };
  }
}
