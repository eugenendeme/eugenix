create or replace function public.admin_resource_metrics(window_days integer default 30)
returns table(
  resource_id uuid,
  title text,
  category_name text,
  published boolean,
  created_at timestamptz,
  published_at timestamptz,
  total_saves bigint,
  total_downloads bigint,
  recent_saves bigint,
  recent_downloads bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Admin authorization required';
  end if;

  window_days := greatest(1, least(coalesce(window_days, 30), 365));

  return query
  select
    r.id,
    r.title,
    c.name,
    r.published,
    r.created_at,
    r.published_at,
    count(distinct (b.user_id, b.resource_id)),
    count(distinct d.id),
    count(distinct (b.user_id, b.resource_id))
      filter (where b.created_at >= now() - make_interval(days => window_days)),
    count(distinct d.id)
      filter (where d.created_at >= now() - make_interval(days => window_days))
  from public.resources r
  join public.categories c on c.id = r.category_id
  left join public.resource_bookmarks b on b.resource_id = r.id
  left join public.downloads d on d.resource_id = r.id
  where r.archived_at is null
  group by r.id, c.name
  order by (
    count(distinct (b.user_id, b.resource_id))
    + count(distinct d.id)
  ) desc, r.title;
end;
$$;

create or replace function public.admin_category_metrics(window_days integer default 30)
returns table(
  category_id uuid,
  category_name text,
  category_slug text,
  published_resources bigint,
  total_saves bigint,
  total_downloads bigint,
  recent_saves bigint,
  recent_downloads bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Admin authorization required';
  end if;

  window_days := greatest(1, least(coalesce(window_days, 30), 365));

  return query
  select
    c.id,
    c.name,
    c.slug,
    count(distinct r.id)
      filter (where r.published and r.archived_at is null),
    count(distinct (b.user_id, b.resource_id))
      filter (where r.archived_at is null),
    count(distinct d.id)
      filter (where r.archived_at is null),
    count(distinct (b.user_id, b.resource_id))
      filter (
        where r.archived_at is null
          and b.created_at >= now() - make_interval(days => window_days)
      ),
    count(distinct d.id)
      filter (
        where r.archived_at is null
          and d.created_at >= now() - make_interval(days => window_days)
      )
  from public.categories c
  left join public.resources r on r.category_id = c.id
  left join public.resource_bookmarks b on b.resource_id = r.id
  left join public.downloads d on d.resource_id = r.id
  group by c.id
  order by c.sort_order, c.name;
end;
$$;