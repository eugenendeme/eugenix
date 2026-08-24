begin;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and public.is_admin(auth.uid());
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "downloads are readable by owner or admin" on public.downloads;
drop policy if exists "downloads are owner readable" on public.downloads;
create policy "downloads are owner readable"
on public.downloads for select to authenticated
using (user_id = auth.uid());

alter table public.resources
  add constraint resources_teaser_length_check check (char_length(teaser) <= 500) not valid,
  add constraint resources_description_length_check check (description is null or char_length(description) <= 20000) not valid,
  add constraint resources_author_length_check check (author is null or char_length(author) <= 160) not valid,
  add constraint resources_tags_count_check check (cardinality(tags) <= 20) not valid;

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
    'published_resources',(select count(*) from public.resources where published),
    'draft_resources',(select count(*) from public.resources where not published),
    'total_saves',(select count(*) from public.resource_bookmarks),
    'total_downloads',(select count(*) from public.downloads),
    'window_days',window_days
  ) into result;
  return result;
end; $$;

create or replace function public.admin_resource_metrics(window_days integer default 30)
returns table(resource_id uuid,title text,category_name text,published boolean,created_at timestamptz,published_at timestamptz,total_saves bigint,total_downloads bigint,recent_saves bigint,recent_downloads bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  window_days := greatest(1,least(coalesce(window_days,30),365));
  return query select r.id,r.title,c.name,r.published,r.created_at,r.published_at,
    count(distinct (b.user_id,b.resource_id)),count(distinct d.id),
    count(distinct (b.user_id,b.resource_id)) filter(where b.created_at>=now()-make_interval(days=>window_days)),
    count(distinct d.id) filter(where d.created_at>=now()-make_interval(days=>window_days))
  from public.resources r join public.categories c on c.id=r.category_id
  left join public.resource_bookmarks b on b.resource_id=r.id left join public.downloads d on d.resource_id=r.id
  group by r.id,c.name order by (count(distinct (b.user_id,b.resource_id))+count(distinct d.id)) desc,r.title;
end; $$;

create or replace function public.admin_category_metrics(window_days integer default 30)
returns table(category_id uuid,category_name text,category_slug text,published_resources bigint,total_saves bigint,total_downloads bigint,recent_saves bigint,recent_downloads bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  window_days := greatest(1,least(coalesce(window_days,30),365));
  return query select c.id,c.name,c.slug,count(distinct r.id) filter(where r.published),
    count(distinct (b.user_id,b.resource_id)),count(distinct d.id),
    count(distinct (b.user_id,b.resource_id)) filter(where b.created_at>=now()-make_interval(days=>window_days)),
    count(distinct d.id) filter(where d.created_at>=now()-make_interval(days=>window_days))
  from public.categories c left join public.resources r on r.category_id=c.id
  left join public.resource_bookmarks b on b.resource_id=r.id left join public.downloads d on d.resource_id=r.id
  group by c.id order by c.sort_order,c.name;
end; $$;

create or replace function public.admin_user_summaries()
returns table(display_name text,avatar_url text,joined_at timestamptz,total_saves bigint,total_downloads bigint,last_resource_activity timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  return query select coalesce(p.display_name,'Unnamed account'),p.avatar_url,p.created_at,
    (select count(*) from public.resource_bookmarks b where b.user_id=p.id),
    (select count(*) from public.downloads d where d.user_id=p.id),
    greatest((select max(b.created_at) from public.resource_bookmarks b where b.user_id=p.id),(select max(d.created_at) from public.downloads d where d.user_id=p.id))
  from public.profiles p order by p.created_at desc;
end; $$;

create or replace function public.admin_engagement_trend(window_days integer default 30)
returns table(activity_day date,saves bigint,downloads bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501', message='Admin authorization required'; end if;
  window_days := greatest(1,least(coalesce(window_days,30),365));
  return query select day::date,
    (select count(*) from public.resource_bookmarks b where b.created_at>=day and b.created_at<day+interval '1 day'),
    (select count(*) from public.downloads d where d.created_at>=day and d.created_at<day+interval '1 day')
  from generate_series(current_date-(window_days-1),current_date,interval '1 day') day order by day;
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
    union all select 'published','Admin',r.title,r.published_at from public.resources r where r.published and r.published_at is not null
  ) x order by x.occurred_at desc limit activity_limit;
end; $$;

revoke all on function public.admin_overview(integer) from public,anon;
revoke all on function public.admin_resource_metrics(integer) from public,anon;
revoke all on function public.admin_category_metrics(integer) from public,anon;
revoke all on function public.admin_user_summaries() from public,anon;
revoke all on function public.admin_engagement_trend(integer) from public,anon;
revoke all on function public.admin_recent_activity(integer) from public,anon;
grant execute on function public.admin_overview(integer),public.admin_resource_metrics(integer),public.admin_category_metrics(integer),public.admin_user_summaries(),public.admin_engagement_trend(integer),public.admin_recent_activity(integer) to authenticated;

commit;
