create view public.notice_issuers with (security_invoker = false) as
  select u.id, u.name
  from public.users u
  where u.role in ('faculty', 'admin')
    or exists (select 1 from public.notices n where n.created_by = u.id)
    or exists (select 1 from public.materials m where m.uploaded_by = u.id);

grant select on public.notice_issuers to authenticated;

alter table public.notifications
  add column issued_by bigint references public.users(id) on delete restrict;

update public.notifications n
set issued_by = coalesce(
  (select notice.created_by from public.notices notice where notice.id = n.notice_id),
  (select material.uploaded_by from public.materials material where material.id = n.material_id)
);

alter table public.notifications
  alter column issued_by set not null;

create or replace function public.notify_notice_audience()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;
  insert into public.notifications (user_id, event_type, title, body, notice_id, issued_by)
  select s.user_id, 'notice', 'New notice: ' || new.title, left(new.body, 240), new.id, new.created_by
  from public.students s
  join public.users u on u.id = s.user_id and u.active
  where (
    (new.course_id is not null and exists (
      select 1 from public.courses c where c.id = new.course_id
        and c.program_code = s.program_code and c.year = s.year
        and (nullif(c.section, '') is null or c.section = s.section)
    ))
    or
    (new.course_id is null
      and (new.department is null or new.department = '' or new.department = s.department or new.department = s.program_code)
      and (new.year is null or new.year = '' or new.year = s.year)
      and (new.section is null or new.section = '' or new.section = s.section))
  );
  return new;
end;
$$;

create or replace function public.notify_material_audience()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.visibility <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.visibility = 'published' and old.version = new.version then return new; end if;
  insert into public.notifications (user_id, event_type, title, body, material_id, issued_by)
  select s.user_id, 'material', 'New material: ' || new.title, new.unit || ' has new course material.',
    new.id, new.uploaded_by
  from public.students s
  join public.users u on u.id = s.user_id and u.active
  join public.courses c on c.id = new.course_id and c.program_code = s.program_code and c.year = s.year
    and (nullif(c.section, '') is null or c.section = s.section);
  return new;
end;
$$;
