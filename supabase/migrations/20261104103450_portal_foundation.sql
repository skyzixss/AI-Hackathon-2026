begin;
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
 student_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, faculty text not null, program text not null,
 course smallint not null check (course between 1 and 6), group_name text not null
);
create table public.schedule_entries (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(student_id) on delete cascade,
 subject text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 room text not null, teacher text not null, change_note text,
 check (ends_at > starts_at)
);
create table public.grades (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(student_id) on delete cascade,
 subject text not null, assessment text not null check (assessment in ('exam','credit','coursework')),
 result text not null, semester smallint not null check (semester between 1 and 12),
 exam_at timestamptz
);
create table public.requests (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null default auth.uid() references public.profiles(student_id) on delete cascade,
 kind text not null check (kind in ('certificate','application')),
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 status text not null default 'submitted' check (status in ('submitted','in_review','ready','rejected')),
 created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(student_id) on delete cascade,
 title text not null, body text not null,
 created_at timestamptz not null default now(), read_at timestamptz
);
create index schedule_student_time on public.schedule_entries(student_id,starts_at);
create index grades_student_semester on public.grades(student_id,semester);
create index requests_student_time on public.requests(student_id,created_at desc);
create index notifications_student_time on public.notifications(student_id,created_at desc);

-- Revoke table defaults explicitly: API roles cannot choose the owner or status.
revoke all on public.profiles,public.schedule_entries,public.grades,public.requests,public.notifications from anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles,public.schedule_entries,public.grades,public.requests,public.notifications to authenticated;
grant insert(kind,body) on public.requests to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant all on public.profiles,public.schedule_entries,public.grades,public.requests,public.notifications to service_role;
alter table public.profiles enable row level security;
create policy own_select on public.profiles for select to authenticated
 using ((select auth.uid()) = student_id);
alter table public.schedule_entries enable row level security;
create policy own_select on public.schedule_entries for select to authenticated
 using ((select auth.uid()) = student_id);
alter table public.grades enable row level security;
create policy own_select on public.grades for select to authenticated
 using ((select auth.uid()) = student_id);
alter table public.requests enable row level security;
create policy own_select on public.requests for select to authenticated
 using ((select auth.uid()) = student_id);
alter table public.notifications enable row level security;
create policy own_select on public.notifications for select to authenticated
 using ((select auth.uid()) = student_id);
create policy own_insert on public.requests for insert to authenticated
 with check ((select auth.uid()) = student_id and status = 'submitted');
create policy own_read_update on public.notifications for update to authenticated
 using ((select auth.uid()) = student_id)
 with check ((select auth.uid()) = student_id);

-- Trigger is internal, not an exposed RPC. Ownership comes from the inserted row.
create function private.notify_request_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.notifications(student_id,title,body)
 values (new.student_id,'Заявка принята','Заявка зарегистрирована. Статус: submitted.');
 return new;
end;
$$;
revoke all on function private.notify_request_created() from public,anon,authenticated;
create trigger request_created after insert on public.requests
for each row execute function private.notify_request_created();
commit;
