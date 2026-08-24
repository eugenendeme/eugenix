begin;

grant insert, update, delete
on table public.resources
to authenticated;

grant insert, update, delete
on table public.categories
to authenticated;

commit;