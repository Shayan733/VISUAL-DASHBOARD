-- Spines: the 4-line story spine, append-only versions
create table if not exists spines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version integer not null,
  want text not null,
  stakes text not null,
  hero_belief text not null,
  villain_belief text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists spines_project_idx on spines (project_id, version desc);
