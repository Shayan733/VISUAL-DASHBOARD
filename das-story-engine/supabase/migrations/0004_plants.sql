-- Plants: the plant/payoff table; a plant is an orphan until paid off
create table if not exists plants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  plant_text text not null,
  planted_scene integer not null,
  payoff_text text,
  payoff_scene integer,
  status text not null default 'orphan'
    check (status in ('paid', 'orphan')),
  created_at timestamptz not null default now()
);

create index if not exists plants_project_idx on plants (project_id);
