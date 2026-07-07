-- Chat attachments (images + PDFs).
-- Run this in the Supabase SQL editor (after 0003_chat_history.sql).

alter table chat_messages add column attachments jsonb;

-- Private storage bucket for attachment binaries. The app also attempts to
-- create this at runtime, but creating it here makes setup deterministic.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
