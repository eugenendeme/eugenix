begin;

alter table public.resources
  add column if not exists archived_at timestamptz;

alter table public.resources
  add constraint resources_archive_state_check
  check (archived_at is null or published = false) not valid;

create index if not exists resources_archived_at_idx
  on public.resources (archived_at desc)
  where archived_at is not null;

drop policy if exists "resources are publicly readable when published" on public.resources;
create policy "resources are publicly readable when published"
on public.resources
for select
using ((published = true and archived_at is null) or public.is_admin());

drop policy if exists "resource likes are user insertable" on public.resource_likes;
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
      and r.archived_at is null
  )
);

create or replace function public.save_resource(target_resource_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.resources r
    where r.id = target_resource_id
      and r.published = true
      and r.archived_at is null
  ) then
    return false;
  end if;

  insert into public.resource_bookmarks (user_id, resource_id)
  values (current_user_id, target_resource_id)
  on conflict (user_id, resource_id) do nothing;

  return true;
end;
$$;

revoke all on function public.save_resource(uuid) from public, anon;
grant execute on function public.save_resource(uuid) to authenticated;

create or replace function public.admin_overview(window_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  window_days := greatest(1, least(coalesce(window_days,30),365));
  select jsonb_build_object(
    'total_users',(select count(*) from public.profiles),
    'new_users_today',(select count(*) from public.profiles where created_at >= current_date),
    'new_users_7d',(select count(*) from public.profiles where created_at >= now()-interval '7 days'),
    'new_users_30d',(select count(*) from public.profiles where created_at >= now()-interval '30 days'),
    'published_resources',(select count(*) from public.resources where published and archived_at is null),
    'draft_resources',(select count(*) from public.resources where not published and archived_at is null),
    'archived_resources',(select count(*) from public.resources where archived_at is not null),
    'total_saves',(select count(*) from public.resource_bookmarks),
    'total_downloads',(select count(*) from public.downloads),
    'window_days',window_days
  ) into result;
  return result;
end; $$;

create or replace function public.admin_category_metrics(window_days integer default 30)
returns table(category_id uuid,category_name text,category_slug text,published_resources bigint,total_saves bigint,total_downloads bigint,recent_saves bigint,recent_downloads bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  window_days := greatest(1,least(coalesce(window_days,30),365));
  return query select c.id,c.name,c.slug,count(distinct r.id) filter(where r.published and r.archived_at is null),
    count(distinct (b.user_id,b.resource_id)),count(distinct d.id),
    count(distinct (b.user_id,b.resource_id)) filter(where b.created_at>=now()-make_interval(days=>window_days)),
    count(distinct d.id) filter(where d.created_at>=now()-make_interval(days=>window_days))
  from public.categories c left join public.resources r on r.category_id=c.id
  left join public.resource_bookmarks b on b.resource_id=r.id left join public.downloads d on d.resource_id=r.id
  group by c.id order by c.sort_order,c.name;
end; $$;

create or replace function public.admin_recent_activity(activity_limit integer default 20)
returns table(activity_type text,actor_name text,resource_title text,occurred_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  activity_limit := greatest(1,least(coalesce(activity_limit,20),100));
  return query select x.activity_type,x.actor_name,x.resource_title,x.occurred_at from (
    select 'saved'::text as activity_type,coalesce(p.display_name,'Unnamed account') as actor_name,r.title as resource_title,b.created_at as occurred_at from public.resource_bookmarks b join public.resources r on r.id=b.resource_id left join public.profiles p on p.id=b.user_id
    union all select 'downloaded',coalesce(p.display_name,'Unnamed account'),r.title,d.created_at from public.downloads d join public.resources r on r.id=d.resource_id left join public.profiles p on p.id=d.user_id
    union all select 'joined',coalesce(p.display_name,'Unnamed account'),null::text,p.created_at from public.profiles p
    union all select 'published','Admin',r.title,r.published_at from public.resources r where r.published and r.archived_at is null and r.published_at is not null
    union all select 'archived','Admin',r.title,r.archived_at from public.resources r where r.archived_at is not null
  ) x order by x.occurred_at desc limit activity_limit;
end; $$;

commit;
