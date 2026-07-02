-- Audits: one row per audit run, with a JSON list of failures
create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  run_number integer not null,
  result text not null check (result in ('pass', 'fail')),
  failures_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, run_number)
);

create index if not exists audits_project_idx on audits (project_id, run_number desc);
