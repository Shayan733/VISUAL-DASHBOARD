import type {
  Project, Spine, Phase, Plant, Scene, Audit, ProjectState, SceneState,
} from '../types/index.js';

/** Everything a storage backend must provide. Each method mirrors one
 *  pipeline step. Implementations: MemoryStore (default), SupabaseStore
 *  (activated by SUPABASE_URL + SUPABASE_SERVICE_KEY). */
export interface Store {
  /* projects */
  createProject(title: string, briefText: string): Promise<Project>;
  getProject(projectId: string): Promise<Project | null>;
  findProjectByTitle(title: string): Promise<Project | null>;

  /* spines — append-only versions */
  saveSpine(projectId: string, spine: {
    want: string; stakes: string; hero_belief: string; villain_belief: string;
    approved: boolean;
  }): Promise<Spine>;
  latestSpine(projectId: string): Promise<Spine | null>;

  /* phases — all 8 in one call, replaces previous set */
  savePhases(projectId: string, phases: Array<{
    phase_number: number; phase_name: string; one_liner: string;
  }>): Promise<Phase[]>;
  listPhases(projectId: string): Promise<Phase[]>;

  /* plants — replaces previous table */
  savePlants(projectId: string, plants: Array<{
    plant_text: string; planted_scene: number;
    payoff_text?: string | null; payoff_scene?: number | null;
  }>): Promise<Plant[]>;
  listPlants(projectId: string): Promise<Plant[]>;

  /* scenes — card first, prose as new versions */
  saveSceneCard(projectId: string, card: {
    scene_number: number; location?: string;
    who: string; want: string; block: string; turn: string;
    plant_ref?: string | null;
  }): Promise<Scene>;
  saveSceneProse(projectId: string, sceneNumber: number, prose: string): Promise<Scene>;
  setSceneState(projectId: string, sceneNumber: number, state: SceneState): Promise<Scene>;
  latestScenes(projectId: string): Promise<Scene[]>;

  /* audits */
  saveAudit(projectId: string, result: 'pass' | 'fail', failures: string[]): Promise<Audit>;
  latestAudit(projectId: string): Promise<Audit | null>;

  /* the session memory */
  getProjectState(projectId: string): Promise<ProjectState | null>;
}

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
