-- Family profile & onboarding support.
-- Run this in the Supabase SQL editor (after 0001_init.sql).

alter table households add column notes text;
alter table households add column onboarded boolean not null default false;

alter table members add column email text;
alter table members add column phone text;
alter table members add column birthday date;
