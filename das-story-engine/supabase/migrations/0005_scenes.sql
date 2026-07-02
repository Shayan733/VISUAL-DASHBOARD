-- Scenes: card (who/want/block/turn) + versioned prose + state machine
create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_number integer not null,
  location text not null default '',
  who text not null,
  want text not null,
  block text not null,
  turn text not null,
  plant_ref uuid references plants(id),
  prose_text text,
  state text not null default 'draft'
    check (state in ('draft', 'approved', 'audit_fail')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (project_id, scene_number, version)
);

create index if not exists scenes_project_idx on scenes (project_id, scene_number, version desc);
