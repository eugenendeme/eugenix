create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = coalesce($1, auth.uid())
      and ur.role = 'admin'
  );
$function$;