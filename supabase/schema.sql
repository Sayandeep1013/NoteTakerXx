-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────

-- ── Notes table ──────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  x           integer     not null default 0,
  y           integer     not null default 0,
  w           integer     not null default 4,
  h           integer     not null default 4,
  color       text        not null default 'yellow',
  rotation    real        not null default 0,
  locked      boolean     not null default false,
  z_index     integer     not null default 10,
  title       text        not null default '',
  body        text        not null default '',
  badges      text[]      not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- If table already exists, add the badges column:
-- ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS badges text[] NOT NULL DEFAULT '{}';

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger notes_updated_at
  before update on public.notes
  for each row execute procedure public.handle_updated_at();

alter table public.notes enable row level security;
create policy "select own notes"  on public.notes for select  using (auth.uid() = user_id);
create policy "insert own notes"  on public.notes for insert  with check (auth.uid() = user_id);
create policy "update own notes"  on public.notes for update  using (auth.uid() = user_id);
create policy "delete own notes"  on public.notes for delete  using (auth.uid() = user_id);
create index if not exists notes_user_id_idx on public.notes(user_id);

-- ── Profiles table ───────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  username    text,
  avatar_url  text,
  theme       text,
  custom_badges jsonb not null default '[]'::jsonb,
  updated_at  timestamptz default now()
);

alter table public.profiles add column if not exists theme text;
alter table public.profiles add column if not exists custom_badges jsonb not null default '[]'::jsonb;

alter table public.profiles enable row level security;
create policy "profiles viewable by all"     on public.profiles for select  using (true);
create policy "users insert own profile"     on public.profiles for insert  with check (auth.uid() = id);
create policy "users update own profile"     on public.profiles for update  using (auth.uid() = id);

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end; $$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Storage: avatars bucket ───────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "authenticated users upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
