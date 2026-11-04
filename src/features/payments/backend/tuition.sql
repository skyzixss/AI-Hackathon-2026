-- Prepared extension for review by #4. Apply ONLY to a dedicated fictional demo project.
-- No bank connection, real payment credentials or card data.
begin;
create table public.tuition_charges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(student_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  contract_number text not null,
  amount_kopecks integer not null check (amount_kopecks between 1 and 100000000),
  due_on date not null,
  paid_at timestamptz,
  payment_reference text unique,
  demo_only boolean not null default true check (demo_only),
  check ((paid_at is null) = (payment_reference is null))
);
create index tuition_student_due on public.tuition_charges(student_id, due_on);
revoke all on public.tuition_charges from public, anon, authenticated;
grant select on public.tuition_charges to authenticated;
grant all on public.tuition_charges to service_role;
alter table public.tuition_charges enable row level security;
create policy own_tuition on public.tuition_charges for select to authenticated
  using ((select auth.uid()) = student_id);

-- The invoice is locked before changing state. Retries/concurrent calls return
-- the same receipt. A caller cannot supply amount, owner or payment status.
create function public.complete_demo_tuition_payment(charge_id uuid)
returns setof public.tuition_charges
language plpgsql security definer set search_path = '' as $$
declare
  charge public.tuition_charges%rowtype;
  student uuid := auth.uid();
begin
  if student is null then raise insufficient_privilege using message = 'Invoice unavailable'; end if;
  select * into charge from public.tuition_charges
    where id = charge_id and student_id = student and demo_only for update;
  if not found then raise insufficient_privilege using message = 'Invoice unavailable'; end if;
  if charge.paid_at is null then
    update public.tuition_charges set paid_at = now(),
      payment_reference = 'DEMO-' || replace(gen_random_uuid()::text, '-', '')
      where id = charge.id returning * into charge;
  end if;
  return next charge;
end;
$$;
revoke all on function public.complete_demo_tuition_payment(uuid) from public, anon, authenticated;
grant execute on function public.complete_demo_tuition_payment(uuid) to authenticated;
commit;
