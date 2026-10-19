-- Run only as trusted project administrator. Every fixture/config change rolls back.
-- Tests actual hosted PostgreSQL roles/RLS, with synthetic auth.users + JWT claim fixtures.
-- This is NOT an Auth signup/login test or a cross-connection concurrency test.
begin;
select set_config('griddesk_test.a',gen_random_uuid()::text,true),set_config('griddesk_test.b',gen_random_uuid()::text,true),set_config('griddesk_test.ta',gen_random_uuid()::text,true),set_config('griddesk_test.tb',gen_random_uuid()::text,true),set_config('griddesk_test.key',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('griddesk_test.a')::uuid,'griddesk-test-a@example.invalid'),(current_setting('griddesk_test.b')::uuid,'griddesk-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('griddesk_test.a'),true);
select public.onboard_operator('Temporary Test Operator A');
insert into public.tenants(id,operator_id,name,meter_id,business_type) values(current_setting('griddesk_test.ta')::uuid,auth.uid(),'Temporary Welder','TEST-A','welder');
select set_config('request.jwt.claim.sub',current_setting('griddesk_test.b'),true);
select public.onboard_operator('Temporary Test Operator B');
insert into public.tenants(id,operator_id,name,meter_id) values(current_setting('griddesk_test.tb')::uuid,auth.uid(),'Temporary Household','TEST-B');
insert into public.energy_logs(tenant_id,kwh_consumed) values(current_setting('griddesk_test.tb')::uuid,12.5);
select set_config('request.jwt.claim.sub',current_setting('griddesk_test.a'),true);
do $$declare n int; begin
 if (select count(*) from public.operators)<>1 then raise exception 'FAIL operator isolation'; end if;
 if exists(select 1 from public.tenants where id=current_setting('griddesk_test.tb')::uuid) then raise exception 'FAIL tenant read isolation'; end if;
 if exists(select 1 from public.energy_logs where tenant_id=current_setting('griddesk_test.tb')::uuid) then raise exception 'FAIL energy read isolation'; end if;
 update public.tenants set name='Unauthorised' where id=current_setting('griddesk_test.tb')::uuid;
 get diagnostics n=row_count; if n<>0 then raise exception 'FAIL cross-owner update'; end if;
 begin update public.tenants set current_balance=100 where id=current_setting('griddesk_test.ta')::uuid; raise exception 'FAIL balance privilege'; exception when insufficient_privilege then null; end;
 begin update public.tenants set operator_id=current_setting('griddesk_test.b')::uuid where id=current_setting('griddesk_test.ta')::uuid; raise exception 'FAIL ownership transfer'; exception when insufficient_privilege then null; end;
 begin insert into public.payments(tenant_id,amount,status,idempotency_key) values(current_setting('griddesk_test.ta')::uuid,10,'successful',gen_random_uuid()); raise exception 'FAIL payment privilege'; exception when insufficient_privilege then null; end;
 begin perform public.simulate_payment(current_setting('griddesk_test.ta')::uuid,10,gen_random_uuid()); raise exception 'FAIL disabled demo'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update private.environment set demo_enabled=true where singleton;
insert into private.demo_operators(operator_id) values(current_setting('griddesk_test.a')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('griddesk_test.a'),true);
do $$declare first_result record; retry_result record; s jsonb; begin
 begin perform public.simulate_payment(current_setting('griddesk_test.tb')::uuid,10,gen_random_uuid()); raise exception 'FAIL RPC ownership'; exception when insufficient_privilege then null; end;
 begin perform public.simulate_payment(current_setting('griddesk_test.ta')::uuid,-1,gen_random_uuid()); raise exception 'FAIL invalid amount'; exception when invalid_parameter_value then null; end;
 select * into first_result from public.simulate_payment(current_setting('griddesk_test.ta')::uuid,250,current_setting('griddesk_test.key')::uuid);
 select * into retry_result from public.simulate_payment(current_setting('griddesk_test.ta')::uuid,250,current_setting('griddesk_test.key')::uuid);
 if first_result.balance<>250 or not first_result.is_simulated or first_result.status<>'successful' then raise exception 'FAIL atomic result'; end if;
 if first_result.payment_id<>retry_result.payment_id or not retry_result.replayed or retry_result.balance<>250 then raise exception 'FAIL idempotency'; end if;
 if (select count(*) from public.payments)<>1 then raise exception 'FAIL duplicate rows'; end if;
 begin perform public.simulate_payment(current_setting('griddesk_test.ta')::uuid,251,current_setting('griddesk_test.key')::uuid); raise exception 'FAIL key conflict'; exception when invalid_parameter_value then null; end;
 s:=public.dashboard_summary();
 if (s->>'real_revenue')::numeric<>0 or (s->>'simulated_collections')::numeric<>250 or (s->>'active_businesses')::int<>1 then raise exception 'FAIL summary'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('griddesk_test.b'),true);
do $$begin
 if exists(select 1 from public.payments) then raise exception 'FAIL payment read isolation'; end if;
 begin perform public.simulate_payment(current_setting('griddesk_test.tb')::uuid,10,gen_random_uuid()); raise exception 'FAIL allowlist'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.tenants set current_balance=999999999999.99 where id=current_setting('griddesk_test.ta')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('griddesk_test.a'),true);
do $$declare k uuid:=gen_random_uuid(); begin
 begin perform public.simulate_payment(current_setting('griddesk_test.ta')::uuid,1,k); raise exception 'FAIL overflow validation'; exception when numeric_value_out_of_range then null; end;
 if exists(select 1 from public.payments where idempotency_key=k) then raise exception 'FAIL atomic rollback'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin perform 1 from public.tenants; raise exception 'FAIL anonymous read'; exception when insufficient_privilege then null; end;
 begin perform public.simulate_payment(current_setting('griddesk_test.ta')::uuid,1,gen_random_uuid()); raise exception 'FAIL anonymous RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select jsonb_build_object('hosted_transaction_checks','passed','fixtures','rolled back','operators_remaining',(select count(*) from public.operators),'tenants_remaining',(select count(*) from public.tenants),'payments_remaining',(select count(*) from public.payments),'demo_enabled',(select demo_enabled from private.environment)) as result;
