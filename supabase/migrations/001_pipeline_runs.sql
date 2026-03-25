-- Pipeline Runs — tracks async pipeline execution
-- Run this in Supabase SQL Editor

create type pipeline_run_status as enum ('running', 'completed', 'failed');

create table pipeline_runs (
  id uuid primary key default uuid_generate_v4(),
  niche_id uuid references client_niches(id),
  status pipeline_run_status not null default 'running',
  current_step text not null default 'starting',
  progress jsonb not null default '{}',
  result jsonb,
  error text,
  started_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_pipeline_runs_status on pipeline_runs(status);

-- RLS
alter table pipeline_runs enable row level security;

create policy "Admins manage pipeline runs" on pipeline_runs for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff'))
);
