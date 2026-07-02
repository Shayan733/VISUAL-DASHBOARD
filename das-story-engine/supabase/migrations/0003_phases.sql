-- Phases: the 8 phase one-liners per project
create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_number integer not null check (phase_number between 1 and 8),
  phase_name text not null,
  one_liner text not null,
  created_at timestamptz not null default now(),
  unique (project_id, phase_number)
);

create index if not exists phases_project_idx on phases (project_id, phase_number);
