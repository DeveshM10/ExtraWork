-- Run in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.enquiries (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  phone text default '',
  message text not null,
  created_at timestamptz not null default now()
);

-- Only the backend (service role key) can read/write; the public anon key cannot.
alter table public.enquiries enable row level security;
