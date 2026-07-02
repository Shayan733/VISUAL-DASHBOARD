/* Data shapes — mirror supabase/migrations exactly. */

export type ProjectStatus = 'active' | 'shipped' | 'archived';
export type PlantStatus = 'paid' | 'orphan';
export type SceneState = 'draft' | 'approved' | 'audit_fail';
export type AuditResult = 'pass' | 'fail';

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  brief_text: string;
  created_at: string;
}

export interface Spine {
  id: string;
  project_id: string;
  version: number;
  want: string;
  stakes: string;
  hero_belief: string;
  villain_belief: string;
  approved: boolean;
  created_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_number: number; // 1–8
  phase_name: string;
  one_liner: string;
  created_at: string;
}

export interface Plant {
  id: string;
  project_id: string;
  plant_text: string;
  planted_scene: number;
  payoff_text: string | null;
  payoff_scene: number | null;
  status: PlantStatus;
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_number: number;
  location: string;
  who: string;
  want: string;
  block: string;
  turn: string;
  plant_ref: string | null;
  prose_text: string | null;
  state: SceneState;
  version: number;
  created_at: string;
}

export interface Audit {
  id: string;
  project_id: string;
  run_number: number;
  result: AuditResult;
  failures_json: string[];
  created_at: string;
}

/** Compact summary returned by get_project_state — never full scripts. */
export interface ProjectState {
  project: Pick<Project, 'id' | 'title' | 'status'> & { brief_preview: string };
  spine: { version: number; approved: boolean } | null;
  phases_saved: number;
  plants: { total: number; orphans: number };
  scenes: Array<{
    scene_number: number;
    state: SceneState;
    version: number;
    has_prose: boolean;
    location: string;
  }>;
  last_audit: { run_number: number; result: AuditResult; failures: string[] } | null;
}
