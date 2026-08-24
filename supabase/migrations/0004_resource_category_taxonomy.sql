-- Phase 06.1: reconcile the public Resource Hub taxonomy without guessing.
-- Safe legacy aliases are merged. Any referenced ambiguous category aborts the
-- migration and names the rows that require an explicit editorial decision.

begin;

lock table public.categories in share row exclusive mode;
lock table public.resources in share row exclusive mode;
lock table public.projects in share row exclusive mode;

create temporary table phase061_canonical_categories (
  slug text primary key,
  name text not null unique,
  sort_order integer not null
) on commit drop;

insert into phase061_canonical_categories (slug, name, sort_order)
values
  ('documentation', 'Documentation', 10),
  ('engineering-notes', 'Engineering Notes', 20),
  ('web', 'Web', 30),
  ('mobile', 'Mobile', 40),
  ('system-design', 'System Design', 50),
  ('ai-prompts', 'AI Prompts', 60);

do $$
declare
  desired record;
  category_by_slug uuid;
  category_by_name uuid;
begin
  for desired in
    select slug, name, sort_order
    from phase061_canonical_categories
    order by sort_order
  loop
    select id into category_by_slug
    from public.categories
    where slug = desired.slug;

    select id into category_by_name
    from public.categories
    where lower(name) = lower(desired.name);

    if category_by_slug is not null
       and category_by_name is not null
       and category_by_slug <> category_by_name then
      update public.resources set category_id = category_by_slug where category_id = category_by_name;
      update public.projects set category_id = category_by_slug where category_id = category_by_name;
      delete from public.categories where id = category_by_name;
    end if;

    if category_by_slug is not null then
      update public.categories
      set name = desired.name,
          sort_order = desired.sort_order
      where id = category_by_slug;
    elsif category_by_name is not null then
      update public.categories
      set slug = desired.slug,
          name = desired.name,
          sort_order = desired.sort_order
      where id = category_by_name;
    else
      insert into public.categories (slug, name, sort_order)
      values (desired.slug, desired.name, desired.sort_order);
    end if;

    category_by_slug := null;
    category_by_name := null;
  end loop;
end;
$$;

-- These aliases are direct naming refinements, so their relationships can be
-- moved safely. Broader legacy names are intentionally not included here.
do $$
declare
  legacy_alias record;
  source_id uuid;
  target_id uuid;
begin
  for legacy_alias in
    select * from (values
      ('web-development', 'web'),
      ('mobile-development', 'mobile')
    ) as aliases(source_slug, target_slug)
  loop
    select id into source_id from public.categories where slug = legacy_alias.source_slug;
    select id into target_id from public.categories where slug = legacy_alias.target_slug;

    if source_id is not null and target_id is not null and source_id <> target_id then
      update public.resources set category_id = target_id where category_id = source_id;
      update public.projects set category_id = target_id where category_id = source_id;
      delete from public.categories where id = source_id;
    end if;

    source_id := null;
    target_id := null;
  end loop;
end;
$$;

do $$
declare
  unsafe_references text;
begin
  select string_agg(
    format('%s (resources=%s, projects=%s)', category_rows.slug, category_rows.resource_count, category_rows.project_count),
    ', ' order by category_rows.slug
  )
  into unsafe_references
  from (
    select
      c.id,
      c.slug,
      (select count(*) from public.resources r where r.category_id = c.id) as resource_count,
      (select count(*) from public.projects p where p.category_id = c.id) as project_count
    from public.categories c
    where c.slug not in (select slug from phase061_canonical_categories)
  ) category_rows
  where category_rows.resource_count > 0 or category_rows.project_count > 0;

  if unsafe_references is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Category reconciliation stopped: ambiguous legacy categories are still referenced: ' || unsafe_references,
      hint = 'Choose an explicit canonical category for each referenced legacy row, update those relationships, and rerun this migration.';
  end if;
end;
$$;

delete from public.categories
where slug not in (select slug from phase061_canonical_categories);

do $$
declare
  final_count integer;
begin
  select count(*) into final_count from public.categories;
  if final_count <> 6 then
    raise exception 'Category reconciliation expected 6 canonical rows, found %', final_count;
  end if;
end;
$$;

commit;
