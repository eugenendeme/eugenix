create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint user_roles_role_check check (role = 'admin')
);

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = coalesce(user_id, auth.uid())
      and ur.role = 'admin'
  );
$$;

do $$
begin
  if to_regclass('public.admin_users') is not null then
    insert into public.user_roles (user_id, role)
    select user_id, 'admin'
    from public.admin_users
    on conflict (user_id) do nothing;
  end if;
end;
$$;

drop policy if exists "admins can read admin users" on public.admin_users;
drop policy if exists "admins manage admin users" on public.admin_users;

drop table if exists public.admin_users;

alter table public.user_roles enable row level security;

drop policy if exists "user roles are admin readable" on public.user_roles;
drop policy if exists "user roles are admin managed" on public.user_roles;

create policy "user roles are admin readable"
on public.user_roles
for select
using (public.is_admin());

create policy "user roles are admin managed"
on public.user_roles
for all
using (public.is_admin())
with check (public.is_admin());

-- Drop profile policies BEFORE removing columns they depend on.
drop policy if exists "profiles are publicly readable" on public.profiles;
drop policy if exists "profiles are editable by owner or admin" on public.profiles;
drop policy if exists "profiles are own readable" on public.profiles;
drop policy if exists "profiles are owner editable" on public.profiles;
drop policy if exists "profiles are owner insertable" on public.profiles;
drop policy if exists "profiles are owner deletable" on public.profiles;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
  ) then
    alter table public.profiles
      rename column full_name to display_name;
  end if;
end;
$$;

alter table public.profiles
  drop column if exists username,
  drop column if exists bio,
  drop column if exists website_url,
  drop column if exists location,
  drop column if exists role,
  drop column if exists is_public;

alter table public.profiles
  alter column display_name drop not null;

create policy "profiles are own readable"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_admin()
);

create policy "profiles are owner insertable"
on public.profiles
for insert
with check (
  id = auth.uid()
  or public.is_admin()
);

create policy "profiles are owner editable"
on public.profiles
for update
using (
  id = auth.uid()
  or public.is_admin()
)
with check (
  id = auth.uid()
  or public.is_admin()
);

create policy "profiles are owner deletable"
on public.profiles
for delete
using (
  id = auth.uid()
  or public.is_admin()
);

alter table public.categories
  drop constraint if exists categories_slug_format_check;

alter table public.categories
  add constraint categories_slug_format_check
  check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

alter table public.categories
  drop constraint if exists categories_name_not_blank_check;

alter table public.categories
  add constraint categories_name_not_blank_check
  check (length(trim(name)) > 0);

create unique index if not exists categories_name_lower_key
  on public.categories (lower(name));

drop policy if exists "categories are publicly readable" on public.categories;
drop policy if exists "categories are admin managed" on public.categories;
drop policy if exists "categories are admin updated" on public.categories;
drop policy if exists "categories are admin deleted" on public.categories;

create policy "categories are publicly readable"
on public.categories
for select
using (true);

create policy "categories are admin managed"
on public.categories
for insert
with check (public.is_admin());

create policy "categories are admin updated"
on public.categories
for update
using (public.is_admin())
with check (public.is_admin());

create policy "categories are admin deleted"
on public.categories
for delete
using (public.is_admin());

alter table public.categories
  drop constraint if exists categories_name_key;

-- Drop resource policies before changing/removing fields they may depend on.
drop policy if exists "resources are publicly readable when published" on public.resources;
drop policy if exists "resources are admin managed" on public.resources;
drop policy if exists "resources are admin inserted" on public.resources;
drop policy if exists "resources are admin updated" on public.resources;
drop policy if exists "resources are admin deleted" on public.resources;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'resources'
      and column_name = 'summary'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'resources'
      and column_name = 'teaser'
  ) then
    alter table public.resources
      rename column summary to teaser;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'resources'
      and column_name = 'is_published'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'resources'
      and column_name = 'published'
  ) then
    alter table public.resources
      rename column is_published to published;
  end if;
end;
$$;

alter table public.resources
  add column if not exists file_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists author text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists published_at timestamptz;

alter table public.resources
  alter column category_id set not null;

alter table public.resources
  alter column file_path set not null,
  alter column file_type set not null,
  alter column published set default false;

alter table public.resources
  drop column if exists source_url,
  drop column if exists download_url,
  drop column if exists cover_image_url,
  drop column if exists is_free;

alter table public.resources
  drop constraint if exists resources_slug_format_check;

alter table public.resources
  add constraint resources_slug_format_check
  check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

alter table public.resources
  drop constraint if exists resources_title_not_blank_check;

alter table public.resources
  add constraint resources_title_not_blank_check
  check (length(trim(title)) > 0);

alter table public.resources
  drop constraint if exists resources_teaser_not_blank_check;

alter table public.resources
  add constraint resources_teaser_not_blank_check
  check (length(trim(teaser)) > 0);

alter table public.resources
  drop constraint if exists resources_file_type_check;

alter table public.resources
  add constraint resources_file_type_check
  check (
    file_type in ('pdf', 'docx', 'md', 'zip')
  );

alter table public.resources
  drop constraint if exists resources_file_path_check;

alter table public.resources
  add constraint resources_file_path_check
  check (
    file_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
  );

alter table public.resources
  drop constraint if exists resources_mime_type_check;

alter table public.resources
  add constraint resources_mime_type_check
  check (
    mime_type is null
    or mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'application/zip',
      'application/x-zip-compressed'
    )
  );

alter table public.resources
  drop constraint if exists resources_category_id_fkey;

alter table public.resources
  add constraint resources_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete restrict;

create unique index if not exists resources_file_path_key
  on public.resources (file_path);

create index if not exists resources_published_created_at_idx
  on public.resources (published, created_at desc);

create index if not exists resources_tags_gin_idx
  on public.resources using gin (tags);

create policy "resources are publicly readable when published"
on public.resources
for select
using (
  published = true
  or public.is_admin()
);

create policy "resources are admin inserted"
on public.resources
for insert
with check (public.is_admin());

create policy "resources are admin updated"
on public.resources
for update
using (public.is_admin())
with check (public.is_admin());

create policy "resources are admin deleted"
on public.resources
for delete
using (public.is_admin());

alter table public.resource_likes
  drop constraint if exists resource_likes_resource_id_fkey,
  drop constraint if exists resource_likes_user_id_fkey;

alter table public.resource_likes
  add constraint resource_likes_resource_id_fkey
  foreign key (resource_id)
  references public.resources(id)
  on delete cascade;

alter table public.resource_likes
  add constraint resource_likes_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create index if not exists resource_likes_user_id_idx
  on public.resource_likes (user_id);

create index if not exists resource_likes_resource_id_idx
  on public.resource_likes (resource_id);

drop policy if exists "resource likes are user owned" on public.resource_likes;
drop policy if exists "resource likes are user readable" on public.resource_likes;
drop policy if exists "resource likes are user insertable" on public.resource_likes;
drop policy if exists "resource likes are user deletable" on public.resource_likes;

create policy "resource likes are user readable"
on public.resource_likes
for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "resource likes are user insertable"
on public.resource_likes
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.resources r
    where r.id = resource_id
      and r.published = true
  )
);

create policy "resource likes are user deletable"
on public.resource_likes
for delete
using (
  user_id = auth.uid()
  or public.is_admin()
);

alter table public.resource_bookmarks
  drop constraint if exists resource_bookmarks_resource_id_fkey,
  drop constraint if exists resource_bookmarks_user_id_fkey;

alter table public.resource_bookmarks
  add constraint resource_bookmarks_resource_id_fkey
  foreign key (resource_id)
  references public.resources(id)
  on delete cascade;

alter table public.resource_bookmarks
  add constraint resource_bookmarks_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create index if not exists resource_bookmarks_user_id_idx
  on public.resource_bookmarks (user_id);

create index if not exists resource_bookmarks_resource_id_idx
  on public.resource_bookmarks (resource_id);

drop policy if exists "resource bookmarks are user owned" on public.resource_bookmarks;
drop policy if exists "resource bookmarks are user readable" on public.resource_bookmarks;
drop policy if exists "resource bookmarks are user insertable" on public.resource_bookmarks;
drop policy if exists "resource bookmarks are user deletable" on public.resource_bookmarks;

create policy "resource bookmarks are user readable"
on public.resource_bookmarks
for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "resource bookmarks are user insertable"
on public.resource_bookmarks
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.resources r
    where r.id = resource_id
      and r.published = true
  )
);

create policy "resource bookmarks are user deletable"
on public.resource_bookmarks
for delete
using (
  user_id = auth.uid()
  or public.is_admin()
);

alter table public.downloads
  drop column if exists source;

create index if not exists downloads_created_at_idx
  on public.downloads (created_at desc);

drop policy if exists "downloads are insertable by authenticated users" on public.downloads;
drop policy if exists "downloads are readable by owner or admin" on public.downloads;
drop policy if exists "downloads are logged by authenticated users" on public.downloads;
drop policy if exists "downloads are admin deletable" on public.downloads;

create policy "downloads are logged by authenticated users"
on public.downloads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.resources r
    where r.id = resource_id
      and r.published = true
  )
);

create policy "downloads are readable by owner or admin"
on public.downloads
for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "downloads are admin deletable"
on public.downloads
for delete
using (public.is_admin());

update public.categories
set
  name = trim(name),
  slug = lower(trim(slug))
where true;

update public.resources
set
  teaser = trim(teaser),
  title = trim(title),
  slug = lower(trim(slug))
where true;

alter table public.categories
  alter column slug set not null,
  alter column name set not null;

alter table public.resources
  alter column slug set not null,
  alter column title set not null,
  alter column teaser set not null,
  alter column published set not null;

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

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'resources',
  'resources',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resources bucket admin select" on storage.objects;
drop policy if exists "resources bucket admin insert" on storage.objects;
drop policy if exists "resources bucket admin update" on storage.objects;
drop policy if exists "resources bucket admin delete" on storage.objects;
drop policy if exists "resources bucket authenticated select" on storage.objects;

create policy "resources bucket admin select"
on storage.objects
for select
using (
  bucket_id = 'resources'
  and public.is_admin()
);

create policy "resources bucket admin insert"
on storage.objects
for insert
with check (
  bucket_id = 'resources'
  and public.is_admin()
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+$'
  and storage.extension(name) in ('pdf', 'docx', 'md', 'zip')
);

create policy "resources bucket admin update"
on storage.objects
for update
using (
  bucket_id = 'resources'
  and public.is_admin()
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+$'
  and storage.extension(name) in ('pdf', 'docx', 'md', 'zip')
)
with check (
  bucket_id = 'resources'
  and public.is_admin()
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+$'
  and storage.extension(name) in ('pdf', 'docx', 'md', 'zip')
);

create policy "resources bucket admin delete"
on storage.objects
for delete
using (
  bucket_id = 'resources'
  and public.is_admin()
);