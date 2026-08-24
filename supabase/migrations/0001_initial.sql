create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  bio text,
  website_url text,
  location text,
  role text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = coalesce(user_id, auth.uid())
  );
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  status text not null default 'draft',
  category_id uuid references public.categories(id) on delete set null,
  featured boolean not null default false,
  hero_image_url text,
  body_md text,
  live_url text,
  repo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  source_url text,
  download_url text,
  cover_image_url text,
  is_free boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resource_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table if not exists public.resource_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  resource_id uuid not null references public.resources(id) on delete cascade,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists categories_sort_order_idx
on public.categories(sort_order);

create index if not exists projects_sort_order_idx
on public.projects(sort_order);

create index if not exists projects_category_id_idx
on public.projects(category_id);

create index if not exists resources_category_id_idx
on public.resources(category_id);

create index if not exists resources_is_published_idx
on public.resources(is_published);

create index if not exists downloads_resource_id_idx
on public.downloads(resource_id);

create index if not exists downloads_user_id_idx
on public.downloads(user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;

create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_resources_updated_at on public.resources;

create trigger set_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.projects enable row level security;
alter table public.resources enable row level security;
alter table public.resource_likes enable row level security;
alter table public.resource_bookmarks enable row level security;
alter table public.downloads enable row level security;

drop policy if exists "profiles are publicly readable"
on public.profiles;

create policy "profiles are publicly readable"
on public.profiles
for select
using (
  is_public = true
  or id = auth.uid()
  or public.is_admin()
);

drop policy if exists "profiles are editable by owner or admin"
on public.profiles;

create policy "profiles are editable by owner or admin"
on public.profiles
for all
using (
  id = auth.uid()
  or public.is_admin()
)
with check (
  id = auth.uid()
  or public.is_admin()
);

drop policy if exists "admins can read admin users"
on public.admin_users;

create policy "admins can read admin users"
on public.admin_users
for select
using (public.is_admin());

drop policy if exists "admins manage admin users"
on public.admin_users;

create policy "admins manage admin users"
on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "categories are publicly readable"
on public.categories;

create policy "categories are publicly readable"
on public.categories
for select
using (true);

drop policy if exists "projects are publicly readable when published"
on public.projects;

create policy "projects are publicly readable when published"
on public.projects
for select
using (
  status = 'published'
  or public.is_admin()
);

drop policy if exists "projects are admin managed"
on public.projects;

create policy "projects are admin managed"
on public.projects
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "resources are publicly readable when published"
on public.resources;

create policy "resources are publicly readable when published"
on public.resources
for select
using (
  is_published = true
  or public.is_admin()
);

drop policy if exists "resources are admin managed"
on public.resources;

create policy "resources are admin managed"
on public.resources
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "resource likes are user owned"
on public.resource_likes;

create policy "resource likes are user owned"
on public.resource_likes
for all
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "resource bookmarks are user owned"
on public.resource_bookmarks;

create policy "resource bookmarks are user owned"
on public.resource_bookmarks
for all
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "downloads are insertable by authenticated users"
on public.downloads;

create policy "downloads are insertable by authenticated users"
on public.downloads
for insert
with check (
  auth.uid() is not null
  or public.is_admin()
);

drop policy if exists "downloads are readable by owner or admin"
on public.downloads;

create policy "downloads are readable by owner or admin"
on public.downloads
for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

insert into public.categories (
  slug,
  name,
  sort_order
)
values
  ('ai', 'AI', 10),
  ('web-development', 'Web Development', 20),
  ('mobile-development', 'Mobile Development', 30),
  ('vibe-coding', 'Vibe Coding', 40),
  ('tech', 'Tech', 50)
on conflict (slug) do nothing;