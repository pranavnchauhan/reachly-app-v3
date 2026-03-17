-- Reachly V3 Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enums
create type user_role as enum ('admin', 'client');
create type lead_status as enum ('discovered', 'validated', 'published', 'revealed', 'disputed', 'refunded');
create type signal_request_status as enum ('pending', 'approved', 'rejected');
create type credit_transaction_type as enum ('purchase', 'debit', 'refund');
create type dispute_status as enum ('pending', 'approved', 'rejected');

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  company_name text,
  role user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Niche Templates (admin creates)
create table niche_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null default '',
  industries text[] not null default '{}',
  keywords text[] not null default '{}',
  employee_min int not null default 10,
  employee_max int not null default 500,
  signals jsonb not null default '[]',
  target_titles text[] not null default '{}',
  email_templates jsonb not null default '[]',
  is_active boolean not null default true,
  created_by uuid references profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Client Niches (forked from template)
create table client_niches (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) not null,
  template_id uuid references niche_templates(id) not null,
  name text not null,
  enabled_signals text[] not null default '{}',
  geography text[] not null default '{}',
  employee_min int,
  employee_max int,
  excluded_companies text[] not null default '{}',
  custom_email_templates jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Signal Requests (client requests custom signals)
create table signal_requests (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) not null,
  client_niche_id uuid references client_niches(id) not null,
  signal_name text not null,
  signal_description text not null,
  status signal_request_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leads
create table leads (
  id uuid primary key default uuid_generate_v4(),
  client_niche_id uuid references client_niches(id) not null,
  company_name text not null,
  company_website text,
  company_industry text not null,
  company_size text,
  company_location text,
  signals_matched jsonb not null default '[]',
  justification text not null default '',
  approach_strategies jsonb not null default '[]',
  contact_name text not null,
  contact_title text not null,
  contact_email text,
  contact_phone text,
  contact_linkedin text,
  contact_summary text,
  email_templates jsonb not null default '[]',
  status lead_status not null default 'discovered',
  discovered_at timestamptz not null default now(),
  validated_at timestamptz,
  published_at timestamptz,
  revealed_at timestamptz,
  batch_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Credit Packs
create table credit_packs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) not null,
  total_credits int not null,
  used_credits int not null default 0,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Credit Transactions
create table credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) not null,
  credit_pack_id uuid references credit_packs(id) not null,
  type credit_transaction_type not null,
  amount int not null,
  lead_id uuid references leads(id),
  description text not null default '',
  created_at timestamptz not null default now()
);

-- Disputes
create table disputes (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) not null,
  lead_id uuid references leads(id) not null,
  reason text not null,
  evidence text,
  status dispute_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Indexes
create index idx_client_niches_client on client_niches(client_id);
create index idx_client_niches_template on client_niches(template_id);
create index idx_leads_niche on leads(client_niche_id);
create index idx_leads_status on leads(status);
create index idx_leads_batch on leads(batch_id);
create index idx_credit_packs_client on credit_packs(client_id);
create index idx_credit_transactions_client on credit_transactions(client_id);
create index idx_disputes_client on disputes(client_id);
create index idx_disputes_lead on disputes(lead_id);

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger tr_profiles_updated before update on profiles for each row execute function update_updated_at();
create trigger tr_niche_templates_updated before update on niche_templates for each row execute function update_updated_at();
create trigger tr_client_niches_updated before update on client_niches for each row execute function update_updated_at();
create trigger tr_signal_requests_updated before update on signal_requests for each row execute function update_updated_at();
create trigger tr_leads_updated before update on leads for each row execute function update_updated_at();

-- RLS Policies
alter table profiles enable row level security;
alter table niche_templates enable row level security;
alter table client_niches enable row level security;
alter table signal_requests enable row level security;
alter table leads enable row level security;
alter table credit_packs enable row level security;
alter table credit_transactions enable row level security;
alter table disputes enable row level security;

-- Profiles: users can read own, admins can read all
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Niche Templates: admins full access, clients can read active
create policy "Admins manage niche templates" on niche_templates for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Clients view active templates" on niche_templates for select using (
  is_active = true
);

-- Client Niches: clients see own, admins see all
create policy "Clients manage own niches" on client_niches for all using (client_id = auth.uid());
create policy "Admins manage all niches" on client_niches for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Leads: clients see own published/revealed, admins see all
create policy "Admins manage all leads" on leads for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Clients view own published leads" on leads for select using (
  status in ('published', 'revealed', 'disputed', 'refunded')
  and exists (
    select 1 from client_niches where id = leads.client_niche_id and client_id = auth.uid()
  )
);

-- Credit Packs: clients see own, admins see all
create policy "Clients view own credits" on credit_packs for select using (client_id = auth.uid());
create policy "Admins manage credits" on credit_packs for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Credit Transactions: clients see own, admins see all
create policy "Clients view own transactions" on credit_transactions for select using (client_id = auth.uid());
create policy "Admins manage transactions" on credit_transactions for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Signal Requests: clients manage own, admins manage all
create policy "Clients manage own requests" on signal_requests for all using (client_id = auth.uid());
create policy "Admins manage all requests" on signal_requests for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Disputes: clients manage own, admins manage all
create policy "Clients manage own disputes" on disputes for all using (client_id = auth.uid());
create policy "Admins manage all disputes" on disputes for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
