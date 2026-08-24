begin;

grant usage on schema public to service_role;

grant select on table public.resources to service_role;

grant select on table public.user_roles to service_role;

grant insert on table public.downloads to service_role;

commit;