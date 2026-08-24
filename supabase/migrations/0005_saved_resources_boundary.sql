begin;

drop policy if exists "resource bookmarks are user readable" on public.resource_bookmarks;
drop policy if exists "resource bookmarks are user insertable" on public.resource_bookmarks;
drop policy if exists "resource bookmarks are user deletable" on public.resource_bookmarks;
drop policy if exists "saved resources are owner readable" on public.resource_bookmarks;
drop policy if exists "saved resources are owner deletable" on public.resource_bookmarks;

create policy "saved resources are owner readable"
on public.resource_bookmarks
for select
to authenticated
using (user_id = auth.uid());

create policy "saved resources are owner deletable"
on public.resource_bookmarks
for delete
to authenticated
using (user_id = auth.uid());

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
  ) then
    return false;
  end if;

  insert into public.resource_bookmarks (user_id, resource_id)
  values (current_user_id, target_resource_id)
  on conflict (user_id, resource_id) do nothing;

  return true;
end;
$$;

create or replace function public.unsave_resource(target_resource_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed_count integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  delete from public.resource_bookmarks
  where user_id = current_user_id
    and resource_id = target_resource_id;

  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.save_resource(uuid) from public, anon;
revoke all on function public.unsave_resource(uuid) from public, anon;
grant execute on function public.save_resource(uuid) to authenticated;
grant execute on function public.unsave_resource(uuid) to authenticated;

commit;
