-- Projects: one row per story project
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'active'
    check (status in ('active', 'shipped', 'archived')),
  brief_text text not null default '',
  created_at timestamptz not null default now()
);
