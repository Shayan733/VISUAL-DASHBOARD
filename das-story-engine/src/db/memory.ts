import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Project, Spine, Phase, Plant, Scene, Audit, ProjectState, SceneState,
} from '../types/index.js';
import { Store, StoreError } from './store.js';

interface Data {
  projects: Project[];
  spines: Spine[];
  phases: Phase[];
  plants: Plant[];
  scenes: Scene[];
  audits: Audit[];
}

const emptyData = (): Data => ({
  projects: [], spines: [], phases: [], plants: [], scenes: [], audits: [],
});

/**
 * Default store: in-memory, optionally persisted to a JSON file so local
 * state survives restarts. No database required. Same behavior contract
 * as SupabaseStore so tools don't care which one they run on.
 */
export class MemoryStore implements Store {
  private data: Data;

  constructor(private filePath?: string) {
    this.data = emptyData();
    if (filePath && existsSync(filePath)) {
      try {
        this.data = { ...emptyData(), ...JSON.parse(readFileSync(filePath, 'utf8')) };
      } catch {
        // Corrupt file — start fresh rather than crash the server
        this.data = emptyData();
      }
    }
  }

  private persist() {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private mustProject(projectId: string): Project {
    const p = this.data.projects.find(p => p.id === projectId);
    if (!p) throw new StoreError(`No project with id "${projectId}". Call get_project_state or create_project first.`);
    return p;
  }

  /* ── projects ── */

  async createProject(title: string, briefText: string): Promise<Project> {
    const project: Project = {
      id: randomUUID(),
      title,
      status: 'active',
      brief_text: briefText,
      created_at: new Date().toISOString(),
    };
    this.data.projects.push(project);
    this.persist();
    return project;
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.data.projects.find(p => p.id === projectId) ?? null;
  }

  async findProjectByTitle(title: string): Promise<Project | null> {
    const q = title.trim().toLowerCase();
    return this.data.projects.find(p => p.title.trim().toLowerCase() === q) ?? null;
  }

  /* ── spines ── */

  async saveSpine(projectId: string, spine: {
    want: string; stakes: string; hero_belief: string; villain_belief: string;
    approved: boolean;
  }): Promise<Spine> {
    this.mustProject(projectId);
    const prior = this.data.spines.filter(s => s.project_id === projectId);
    const version = prior.length ? Math.max(...prior.map(s => s.version)) + 1 : 1;
    const row: Spine = {
      id: randomUUID(),
      project_id: projectId,
      version,
      ...spine,
      created_at: new Date().toISOString(),
    };
    this.data.spines.push(row); // append-only: old versions are never touched
    this.persist();
    return row;
  }

  async latestSpine(projectId: string): Promise<Spine | null> {
    const rows = this.data.spines
      .filter(s => s.project_id === projectId)
      .sort((a, b) => b.version - a.version);
    return rows[0] ?? null;
  }

  /* ── phases ── */

  async savePhases(projectId: string, phases: Array<{
    phase_number: number; phase_name: string; one_liner: string;
  }>): Promise<Phase[]> {
    this.mustProject(projectId);
    this.data.phases = this.data.phases.filter(p => p.project_id !== projectId);
    const rows: Phase[] = phases.map(p => ({
      id: randomUUID(),
      project_id: projectId,
      ...p,
      created_at: new Date().toISOString(),
    }));
    this.data.phases.push(...rows);
    this.persist();
    return rows;
  }

  async listPhases(projectId: string): Promise<Phase[]> {
    return this.data.phases
      .filter(p => p.project_id === projectId)
      .sort((a, b) => a.phase_number - b.phase_number);
  }

  /* ── plants ── */

  async savePlants(projectId: string, plants: Array<{
    plant_text: string; planted_scene: number;
    payoff_text?: string | null; payoff_scene?: number | null;
  }>): Promise<Plant[]> {
    this.mustProject(projectId);
    this.data.plants = this.data.plants.filter(p => p.project_id !== projectId);
    const rows: Plant[] = plants.map(p => ({
      id: randomUUID(),
      project_id: projectId,
      plant_text: p.plant_text,
      planted_scene: p.planted_scene,
      payoff_text: p.payoff_text ?? null,
      payoff_scene: p.payoff_scene ?? null,
      // A plant is an orphan until a payoff scene is set
      status: p.payoff_scene != null ? 'paid' : 'orphan',
      created_at: new Date().toISOString(),
    }));
    this.data.plants.push(...rows);
    this.persist();
    return rows;
  }

  async listPlants(projectId: string): Promise<Plant[]> {
    return this.data.plants.filter(p => p.project_id === projectId);
  }

  /* ── scenes ── */

  private latestSceneVersion(projectId: string, sceneNumber: number): Scene | null {
    const rows = this.data.scenes
      .filter(s => s.project_id === projectId && s.scene_number === sceneNumber)
      .sort((a, b) => b.version - a.version);
    return rows[0] ?? null;
  }

  async saveSceneCard(projectId: string, card: {
    scene_number: number; location?: string;
    who: string; want: string; block: string; turn: string;
    plant_ref?: string | null;
  }): Promise<Scene> {
    this.mustProject(projectId);
    const prior = this.latestSceneVersion(projectId, card.scene_number);
    const row: Scene = {
      id: randomUUID(),
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
      version: prior ? prior.version + 1 : 1,
      created_at: new Date().toISOString(),
    };
    this.data.scenes.push(row);
    this.persist();
    return row;
  }

  async saveSceneProse(projectId: string, sceneNumber: number, prose: string): Promise<Scene> {
    this.mustProject(projectId);
    const prior = this.latestSceneVersion(projectId, sceneNumber);
    if (!prior) {
      throw new StoreError(`Scene ${sceneNumber} has no card yet. Call save_scene_card first.`);
    }
    const row: Scene = {
      ...prior,
      id: randomUUID(),
      prose_text: prose,
      state: 'draft', // new prose always re-enters draft
      version: prior.version + 1,
      created_at: new Date().toISOString(),
    };
    this.data.scenes.push(row);
    this.persist();
    return row;
  }

  async setSceneState(projectId: string, sceneNumber: number, state: SceneState): Promise<Scene> {
    this.mustProject(projectId);
    const scene = this.latestSceneVersion(projectId, sceneNumber);
    if (!scene) throw new StoreError(`Scene ${sceneNumber} does not exist.`);
    scene.state = state;
    this.persist();
    return scene;
  }

  async latestScenes(projectId: string): Promise<Scene[]> {
    const byNumber = new Map<number, Scene>();
    for (const s of this.data.scenes.filter(s => s.project_id === projectId)) {
      const cur = byNumber.get(s.scene_number);
      if (!cur || s.version > cur.version) byNumber.set(s.scene_number, s);
    }
    return [...byNumber.values()].sort((a, b) => a.scene_number - b.scene_number);
  }

  /* ── audits ── */

  async saveAudit(projectId: string, result: 'pass' | 'fail', failures: string[]): Promise<Audit> {
    this.mustProject(projectId);
    const prior = this.data.audits.filter(a => a.project_id === projectId);
    const row: Audit = {
      id: randomUUID(),
      project_id: projectId,
      run_number: prior.length ? Math.max(...prior.map(a => a.run_number)) + 1 : 1,
      result,
      failures_json: failures,
      created_at: new Date().toISOString(),
    };
    this.data.audits.push(row);
    this.persist();
    return row;
  }

  async latestAudit(projectId: string): Promise<Audit | null> {
    const rows = this.data.audits
      .filter(a => a.project_id === projectId)
      .sort((a, b) => b.run_number - a.run_number);
    return rows[0] ?? null;
  }

  /* ── the session memory ── */

  async getProjectState(projectId: string): Promise<ProjectState | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    const spine = await this.latestSpine(projectId);
    const phases = await this.listPhases(projectId);
    const plants = await this.listPlants(projectId);
    const scenes = await this.latestScenes(projectId);
    const audit = await this.latestAudit(projectId);

    return {
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        // Compact by design — keeps Claude's context small and cheap
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
