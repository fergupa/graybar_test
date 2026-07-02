-- Family HQ schema.
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.
--
-- All tables carry household_id so the schema is ready for multi-family use.
-- The app currently operates a single household ('default') via the service
-- role key, which bypasses RLS. RLS is enabled with no policies so the anon
-- key can read nothing; when you add Supabase Auth, add per-household
-- policies instead of exposing the service role key.

create table households (
  id text primary key,
  name text not null
);

create table members (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  name text not null,
  role text not null check (role in ('parent', 'child')),
  age int,
  notes text
);

create table budget_categories (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  name text not null,
  monthly_budget numeric not null,
  spent numeric not null default 0
);

create table transactions (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric not null,
  category text not null
);

create table bills (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  name text not null,
  amount numeric not null,
  due_date date not null,
  autopay boolean not null default false,
  paid boolean not null default false
);

create table tasks (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  title text not null,
  assignee text,
  due date,
  done boolean not null default false
);

create table meal_plan (
  household_id text not null references households(id) on delete cascade,
  day date not null,
  dinner text not null,
  notes text,
  primary key (household_id, day)
);

create table groceries (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  name text not null,
  quantity text,
  done boolean not null default false
);

create table calendar_events (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  attendees text[],
  description text
);

create table emails (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  from_addr text not null,
  subject text not null,
  date timestamptz not null,
  body text not null,
  read boolean not null default false
);

create index idx_transactions_household_date on transactions (household_id, date desc);
create index idx_calendar_events_household_start on calendar_events (household_id, start_at);
create index idx_emails_household_date on emails (household_id, date desc);

-- Deny-by-default for anon/authenticated; the server uses the service role.
alter table households enable row level security;
alter table members enable row level security;
alter table budget_categories enable row level security;
alter table transactions enable row level security;
alter table bills enable row level security;
alter table tasks enable row level security;
alter table meal_plan enable row level security;
alter table groceries enable row level security;
alter table calendar_events enable row level security;
alter table emails enable row level security;
