-- Chat history: persisted conversations with the agent team.
-- Run this in the Supabase SQL editor (after 0002_family_profile.sql).

create table conversations (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  household_id text not null references households(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_conversations_household on conversations (household_id, updated_at desc);
create index idx_chat_messages_conversation on chat_messages (conversation_id, created_at, id);

alter table conversations enable row level security;
alter table chat_messages enable row level security;
