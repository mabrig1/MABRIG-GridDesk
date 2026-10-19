-- Run once in a NEW Supabase project's SQL Editor, or via supabase db push.
-- Production-safe default: simulations are OFF. No public service-role key required.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create type public.business_type as enum ('household','welder','cold_storage','tailoring','other');
create table public.operators (
 id uuid primary key references auth.users(id) on delete restrict,
 company_name text not null check (char_length(btrim(company_name)) between 2 and 120),
 email text not null,
 created_at timestamptz not null default now()
);
create table public.tenants (
 id uuid primary key default gen_random_uuid(),
 operator_id uuid not null references public.operators(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 2 and 120),
 business_type public.business_type not null default 'household',
 meter_id text not null check (meter_id = btrim(meter_id) and char_length(meter_id) between 1 and 80),
 current_balance numeric(14,2) not null default 0 check (current_balance >= 0 and current_balance <> 'NaN'::numeric),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(operator_id,meter_id)
);
comment on column public.tenants.current_balance is 'Prepaid credit in Nigerian naira (NGN); not kWh. Simulation does not control a meter.';
create table public.payments (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 amount numeric(12,2) not null check (amount > 0 and amount <= 1000000),
 payment_date timestamptz not null default now(),
 status text not null check (status in ('pending','successful','failed')),
 is_simulated boolean not null default false,
 idempotency_key uuid not null unique,
 created_at timestamptz not null default now()
);
create table public.energy_logs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 kwh_consumed numeric(12,3) not null check (kwh_consumed >= 0 and kwh_consumed <= 1000000),
 log_date timestamptz not null default now()
);
create index tenants_operator_created on public.tenants(operator_id,created_at desc,id);
create index payments_tenant_date on public.payments(tenant_id,payment_date desc,id);
create index energy_tenant_date on public.energy_logs(tenant_id,log_date desc,id);
create table private.environment (
 singleton boolean primary key default true check (singleton),
 demo_enabled boolean not null default false
);
insert into private.environment values(true,false);
create table private.demo_operators (operator_id uuid primary key references public.operators(id) on delete cascade);

alter table public.operators enable row level security;
alter table public.tenants enable row level security;
alter table public.payments enable row level security;
alter table public.energy_logs enable row level security;
alter table private.environment enable row level security;
alter table private.demo_operators enable row level security;
revoke all on public.operators, public.tenants, public.payments, public.energy_logs from public, anon, authenticated;
revoke all on private.environment, private.demo_operators from public, anon, authenticated;
grant usage on schema public to authenticated;
grant usage on type public.business_type to authenticated;
grant select on public.operators, public.tenants, public.payments, public.energy_logs to authenticated;
grant update(company_name) on public.operators to authenticated;
grant insert(id,operator_id,name,business_type,meter_id,is_active) on public.tenants to authenticated;
grant update(name,business_type,meter_id,is_active) on public.tenants to authenticated;
grant insert(id,tenant_id,kwh_consumed,log_date) on public.energy_logs to authenticated;
-- Deliberately no DELETE, balance UPDATE, or payment INSERT/UPDATE/DELETE grants.
create policy operator_read on public.operators for select to authenticated using (id=(select auth.uid()));
create policy operator_update on public.operators for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy tenant_read on public.tenants for select to authenticated using (operator_id=(select auth.uid()));
create policy tenant_create on public.tenants for insert to authenticated with check (operator_id=(select auth.uid()));
create policy tenant_update on public.tenants for update to authenticated using (operator_id=(select auth.uid())) with check (operator_id=(select auth.uid()));
create policy payment_read on public.payments for select to authenticated using (
 exists(select 1 from public.tenants t where t.id=tenant_id and t.operator_id=(select auth.uid()))
);
create policy energy_read on public.energy_logs for select to authenticated using (
 exists(select 1 from public.tenants t where t.id=tenant_id and t.operator_id=(select auth.uid()))
);
create policy energy_create on public.energy_logs for insert to authenticated with check (
 exists(select 1 from public.tenants t where t.id=tenant_id and t.operator_id=(select auth.uid()))
);
create function private.keep_tenant_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.operator_id is distinct from old.operator_id then raise exception 'Tenant ownership is immutable' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.keep_tenant_owner() from public,anon,authenticated;
create trigger tenant_owner_immutable before update on public.tenants for each row execute function private.keep_tenant_owner();

create function public.onboard_operator(p_company_name text) returns public.operators
language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_email text; v_result public.operators;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_company_name is null or char_length(btrim(p_company_name)) not between 2 and 120 then raise exception 'Company name must have 2–120 characters' using errcode='22023'; end if;
 select email into v_email from auth.users where id=v_uid;
 if v_email is null then raise exception 'Email account required' using errcode='42501'; end if;
 insert into public.operators(id,company_name,email) values(v_uid,btrim(p_company_name),v_email)
 on conflict(id) do update set company_name=excluded.company_name,email=excluded.email returning * into v_result;
 return v_result;
end $$;
create function public.demo_access() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from private.environment e join private.demo_operators d on d.operator_id=auth.uid() where e.singleton and e.demo_enabled
 );
$$;
create function public.simulate_payment(p_tenant_id uuid,p_amount numeric,p_idempotency_key uuid)
returns table(payment_id uuid,tenant_id uuid,amount numeric,status text,is_simulated boolean,balance numeric,replayed boolean)
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_enabled boolean; v_tenant public.tenants; v_payment public.payments; v_balance numeric;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Lock configuration and allowlist so an administrative disable cannot race a payment.
 select e.demo_enabled into v_enabled from private.environment e where e.singleton for share;
 if v_enabled is distinct from true then raise exception 'Simulation is disabled in this environment' using errcode='42501'; end if;
 perform 1 from private.demo_operators d where d.operator_id=v_uid for share;
 if not found then raise exception 'Operator is not authorised for simulation' using errcode='42501'; end if;
 if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount,2) then
 raise exception 'Amount must be NGN 0.01–1,000,000 with at most two decimals' using errcode='22023'; end if;
 if p_idempotency_key is null or p_tenant_id is null then raise exception 'Tenant and idempotency key are required' using errcode='22023'; end if;
 -- Serialise the same key even when two requests specify different tenants.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,0));
 select * into v_tenant from public.tenants t where t.id=p_tenant_id and t.operator_id=v_uid for update;
 if not found then raise exception 'Tenant not found or access denied' using errcode='42501'; end if;
 select * into v_payment from public.payments p where p.idempotency_key=p_idempotency_key;
 if found then
  if v_payment.tenant_id<>p_tenant_id or v_payment.amount<>p_amount or not v_payment.is_simulated or v_payment.status<>'successful' then
   raise exception 'Idempotency key already used with a different request' using errcode='22023'; end if;
  return query select v_payment.id,v_payment.tenant_id,v_payment.amount,v_payment.status,v_payment.is_simulated,v_tenant.current_balance,true;
  return;
 end if;
 if not v_tenant.is_active then raise exception 'Reactivate this tenant before simulating a payment' using errcode='22023'; end if;
 insert into public.payments(tenant_id,amount,status,is_simulated,idempotency_key)
 values(p_tenant_id,p_amount,'successful',true,p_idempotency_key) returning * into v_payment;
 update public.tenants t set current_balance=t.current_balance+p_amount where t.id=p_tenant_id returning t.current_balance into v_balance;
 return query select v_payment.id,v_payment.tenant_id,v_payment.amount,v_payment.status,v_payment.is_simulated,v_balance,false;
end $$;
create function public.dashboard_summary() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return pg_catalog.jsonb_build_object(
 'total_tenants',(select count(*) from public.tenants),
 'active_businesses',(select count(*) from public.tenants where is_active and business_type<>'household'),
 'real_revenue',(select coalesce(sum(amount),0) from public.payments where status='successful' and not is_simulated),
 'simulated_collections',(select coalesce(sum(amount),0) from public.payments where status='successful' and is_simulated),
 'total_kwh',(select coalesce(sum(kwh_consumed),0) from public.energy_logs),
 'month_kwh',(select coalesce(sum(kwh_consumed),0) from public.energy_logs where log_date >= (date_trunc('month',now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos')),
 'energy_entries',(select count(*) from public.energy_logs)
 );
end $$;
revoke all on function public.onboard_operator(text),public.demo_access(),public.simulate_payment(uuid,numeric,uuid),public.dashboard_summary() from public,anon,authenticated;
grant execute on function public.onboard_operator(text),public.demo_access(),public.simulate_payment(uuid,numeric,uuid),public.dashboard_summary() to authenticated;
commit;
