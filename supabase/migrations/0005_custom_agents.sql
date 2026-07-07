-- User-defined specialist agents, created from the app UI.
-- Run this in the Supabase SQL editor (after 0004_attachments.sql).

create table custom_agents (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  key text not null,
  label text not null,
  charter text not null,
  system text not null,
  tools jsonb not null default '[]',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, key)
);

alter table custom_agents enable row level security;
