begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase07-a@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase07-b@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.resources (id, slug, title, teaser, category_id, file_path, file_type, published, published_at)
values
  ('71000000-0000-4000-8000-000000000001', 'phase07-published', 'Published fixture', 'Published fixture teaser', (select id from public.categories where slug = 'documentation'), '71000000-0000-4000-8000-000000000001/test.pdf', 'pdf', true, now()),
  ('71000000-0000-4000-8000-000000000002', 'phase07-private', 'Private fixture', 'Private fixture teaser', (select id from public.categories where slug = 'documentation'), '71000000-0000-4000-8000-000000000002/test.pdf', 'pdf', false, null);

insert into public.resources (id, slug, title, teaser, category_id, file_path, file_type, published, published_at, archived_at)
values
  ('71000000-0000-4000-8000-000000000003', 'phase07-archived', 'Archived fixture', 'Archived fixture teaser', (select id from public.categories where slug = 'documentation'), '71000000-0000-4000-8000-000000000003/test.pdf', 'pdf', false, now(), now());

insert into public.resource_bookmarks (user_id, resource_id)
values ('70000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*)::integer from public.resource_bookmarks), 0, 'User A cannot read User B saved rows');
select throws_ok($$insert into public.resource_bookmarks (user_id, resource_id) values ('70000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002')$$, '42501', 'new row violates row-level security policy for table "resource_bookmarks"', 'User A cannot directly create a saved row for User B');
select is((select public.save_resource('71000000-0000-4000-8000-000000000001')), true, 'RPC saves a published resource for current user');
select is((select public.save_resource('71000000-0000-4000-8000-000000000001')), true, 'Repeated save is idempotent');
select is((select count(*)::integer from public.resource_bookmarks), 1, 'Duplicate save does not create a duplicate relationship');
select is((select public.save_resource('71000000-0000-4000-8000-000000000002')), false, 'Unpublished resources cannot be saved');
select is((select public.save_resource('71000000-0000-4000-8000-000000000003')), false, 'Archived resources cannot be saved');
select results_eq($$delete from public.resource_bookmarks where user_id = '70000000-0000-4000-8000-000000000002' returning 1$$, $$select null::integer where false$$, 'User A cannot delete User B saved row');
select results_eq($$update public.resource_bookmarks set created_at = now() where user_id = '70000000-0000-4000-8000-000000000002' returning 1$$, $$select null::integer where false$$, 'User A cannot alter User B saved row');
select is((select public.unsave_resource('71000000-0000-4000-8000-000000000001')), true, 'RPC removes current user saved row');
select is((select public.unsave_resource('71000000-0000-4000-8000-000000000001')), false, 'Repeated unsave is idempotent');

reset role;
set local "request.jwt.claims" = '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.resource_bookmarks), 1, 'User B still reads their own saved row');
select is((select user_id from public.resource_bookmarks limit 1), '70000000-0000-4000-8000-000000000002'::uuid, 'User B row ownership remains unchanged');

select * from finish();
rollback;
