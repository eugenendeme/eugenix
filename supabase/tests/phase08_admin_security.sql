begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000001','authenticated','authenticated','phase08-admin@example.test','',now(),'{}','{"name":"Admin Fixture"}',now(),now()),
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000002','authenticated','authenticated','phase08-user@example.test','',now(),'{}','{"name":"User Fixture"}',now(),now());
insert into public.user_roles(user_id,role) values('80000000-0000-4000-8000-000000000001','admin');
insert into public.resources(id,slug,title,teaser,category_id,file_path,file_type,published,published_at) values
('81000000-0000-4000-8000-000000000003','phase08-bookmark-privacy','Bookmark Privacy','Cross-user privacy fixture',(select id from public.categories where slug='documentation'),'81000000-0000-4000-8000-000000000003/test.pdf','pdf',true,now());
insert into public.resources(id,slug,title,teaser,category_id,file_path,file_type,published) values
('81000000-0000-4000-8000-000000000004','phase08-private-draft','Private Draft','Admin-only draft fixture',(select id from public.categories where slug='documentation'),'81000000-0000-4000-8000-000000000004/test.pdf','pdf',false);
insert into public.resource_bookmarks(user_id,resource_id) values
('80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(public.current_user_is_admin(),false,'Normal user is not admin');
select throws_ok($$select public.admin_overview(30)$$,'42501','Admin authorization required','Normal user cannot access admin analytics');
select throws_ok($$insert into public.resources(id,slug,title,teaser,category_id,file_path,file_type,published) values('81000000-0000-4000-8000-000000000001','phase08-denied','Denied','Denied',(select id from public.categories where slug='documentation'),'81000000-0000-4000-8000-000000000001/test.pdf','pdf',false)$$,'42501','new row violates row-level security policy for table "resources"','Normal user cannot create resources');
select is((select count(*)::integer from public.resources where slug='phase08-private-draft'),0,'Normal user cannot read draft resources');
select results_eq($$update public.resources set title='Denied update' where slug='phase08-private-draft' returning 1$$,$$select null::integer where false$$,'Normal user cannot update draft resources');
select results_eq($$delete from public.resources where slug='phase08-private-draft' returning 1$$,$$select null::integer where false$$,'Normal user cannot delete draft resources');
select results_eq($$update public.categories set description='denied' where slug='documentation' returning 1$$,$$select null::integer where false$$,'Normal user cannot mutate categories');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('resources','81000000-0000-4000-8000-000000000001/test.pdf','80000000-0000-4000-8000-000000000002')$$,'42501','new row violates row-level security policy for table "objects"','Normal user cannot upload resource objects');
select is((select count(*)::integer from public.resource_bookmarks),0,'Normal user cannot read another user bookmark');

reset role;
set local "request.jwt.claims"='{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select is(public.current_user_is_admin(),true,'Admin role resolves from database');
select lives_ok($$select public.admin_overview(30)$$,'Admin can access overview aggregates');
select lives_ok($$select * from public.admin_resource_metrics(30)$$,'Admin can access resource aggregates');
select lives_ok($$select * from public.admin_category_metrics(30)$$,'Admin can access category aggregates');
select lives_ok($$select * from public.admin_user_summaries()$$,'Admin can access privacy-limited user summaries');
select is((select count(*)::integer from public.resources where slug='phase08-private-draft'),1,'Admin can read draft resources');
select lives_ok($$update public.resources set title='Private Draft Updated' where slug='phase08-private-draft'$$,'Admin can update resource metadata');
select lives_ok($$insert into public.resources(id,slug,title,teaser,category_id,file_path,file_type,published) values('81000000-0000-4000-8000-000000000002','phase08-admin-draft','Admin Draft','Admin draft fixture',(select id from public.categories where slug='documentation'),'81000000-0000-4000-8000-000000000002/test.pdf','pdf',false)$$,'Admin can create a draft resource');
select lives_ok($$update public.categories set description='Admin fixture description' where slug='documentation'$$,'Admin can update category metadata');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id) values('resources','81000000-0000-4000-8000-000000000002/test.pdf','80000000-0000-4000-8000-000000000001')$$,'Admin can create a safe-path storage object');

reset role;
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select public.current_user_is_admin()$$,'42501','permission denied for function current_user_is_admin','Signed-out users cannot call admin authorization data');
select throws_ok($$select public.admin_overview(30)$$,'42501','permission denied for function admin_overview','Signed-out users cannot call admin analytics');

select * from finish();
rollback;
