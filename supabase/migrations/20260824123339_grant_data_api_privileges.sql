begin;

grant usage on schema public to anon, authenticated;

grant select on table public.categories to anon, authenticated;

grant select on table public.resources to anon, authenticated;

grant select, insert, update, delete
on table public.projects
to authenticated;

grant select, insert, update, delete
on table public.profiles
to authenticated;

grant select, insert, update, delete
on table public.resource_likes
to authenticated;

grant select, insert, update, delete
on table public.resource_bookmarks
to authenticated;

grant select, insert, delete
on table public.downloads
to authenticated;

grant select, insert, update, delete
on table public.user_roles
to authenticated;

commit;