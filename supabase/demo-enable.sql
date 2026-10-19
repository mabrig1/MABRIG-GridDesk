-- ADMIN ONLY. Run ONLY in a separate disposable DEMO project with fake tenant data.
-- Do not run in production. Replace the UUID after signing up/onboarding a demo user.
begin;
update private.environment set demo_enabled=true where singleton;
insert into private.demo_operators(operator_id) values ('REPLACE_WITH_ONBOARDED_OPERATOR_UUID'::uuid) on conflict do nothing;
commit;
-- Disable: update private.environment set demo_enabled=false where singleton;
