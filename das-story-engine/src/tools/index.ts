import type { ToolDef } from './types.js';
import { createProject } from './create_project.js';
import { saveSpine } from './save_spine.js';
import { getProjectState } from './get_project_state.js';
import { savePhases } from './save_phases.js';
import { savePlants } from './save_plants.js';
import { saveSceneCard } from './save_scene_card.js';
import { saveSceneProse } from './save_scene_prose.js';
import { approveScene } from './approve_scene.js';

export type { ToolDef } from './types.js';
export { asContent } from './types.js';

/** Pipeline order. Adding a tool = one new file + one line here. */
export const ALL_TOOLS: ToolDef[] = [
  createProject,
  saveSpine,
  getProjectState,
  savePhases,
  savePlants,
  saveSceneCard,
  saveSceneProse,
  approveScene,
];
