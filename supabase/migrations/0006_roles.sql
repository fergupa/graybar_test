-- Security roles: member profiles with PINs, per-member conversations,
-- and per-member agent assignment.
-- Run this in the Supabase SQL editor (after 0005_custom_agents.sql).

alter table members add column pin_hash text;

-- Who a conversation belongs to (children only see their own).
alter table conversations add column member_id text;

-- Which members an agent serves (null = the whole family).
alter table custom_agents add column member_ids jsonb;
