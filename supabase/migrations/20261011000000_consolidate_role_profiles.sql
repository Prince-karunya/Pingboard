alter table public.users
  add column if not exists program_code text,
  add column if not exists is_hod boolean not null default false;

update public.users u
set roll_no = s.roll_no,
    program_code = lower(s.program_code),
    department = 'MCA',
    year = s.year,
    section = s.section
from public.students s
where s.user_id = u.id;

update public.users u
set department = 'MCA',
    is_hod = f.is_hod
from public.faculty f
where f.user_id = u.id;

update public.users
set is_hod = false
where role <> 'faculty';

drop view if exists public.account_directory;

drop policy if exists "courses visible to assigned audience and department HOD" on public.courses;
create policy "courses visible to assigned audience and department HOD" on public.courses
  for select to authenticated using (
    public.is_profile_admin()
    or public.is_current_hod_department(courses.department, courses.program_code)
    or faculty_id = public.current_profile_id()
    or exists (
      select 1 from public.users s
      where s.id = public.current_profile_id() and s.role = 'student'
        and s.program_code = courses.program_code and s.year = courses.year
        and (nullif(courses.section, '') is null or s.section = courses.section)
    )
  );

drop policy if exists "notices visible to owner admin or targeted students" on public.notices;
create policy "notices visible to owner admin or targeted students" on public.notices
  for select to authenticated using (
    public.is_profile_admin() or created_by = public.current_profile_id()
    or (
      status = 'published' and publish_at <= now()
      and (
        (course_id is not null and exists (
          select 1 from public.courses c join public.users s on s.id = public.current_profile_id()
          where s.role = 'student' and c.id = course_id
            and c.program_code = s.program_code and c.year = s.year
            and (nullif(c.section, '') is null or c.section = s.section)
        ))
        or (course_id is null and public.matches_current_audience(department, year, section))
      )
    )
  );

drop policy if exists "materials visible to uploader admin department HOD or enrolled students" on public.materials;
create policy "materials visible to uploader admin department HOD or enrolled students" on public.materials
  for select to authenticated using (
    public.is_profile_admin() or uploaded_by = public.current_profile_id()
    or exists (
      select 1 from public.courses c
      where c.id = course_id and public.is_current_hod_department(c.department, c.program_code)
    )
    or (
      visibility = 'published' and exists (
        select 1 from public.courses c join public.users s on s.id = public.current_profile_id()
        where s.role = 'student' and c.id = course_id
          and c.program_code = s.program_code and c.year = s.year
          and (nullif(c.section, '') is null or c.section = s.section)
      )
    )
  );

drop table public.students;
drop table public.faculty;
drop table public.administrators;

alter table public.users
  add constraint users_student_mca_cohorts_only
  check (
    role <> 'student'
    or (
      upper(department) = 'MCA'
      and lower(program_code) = 'mca'
      and ((section = 'AMCA' and year = '1') or (section = 'NMCA' and year = '2'))
    )
  );

alter table public.users
  add constraint users_faculty_mca_only
  check (role <> 'faculty' or upper(department) = 'MCA');

create view public.students with (security_invoker = true) as
  select id as user_id, roll_no, program_code, department, year, section
  from public.users
  where role = 'student';

create view public.faculty with (security_invoker = true) as
  select id as user_id, department, is_hod
  from public.users
  where role = 'faculty';

create view public.administrators with (security_invoker = true) as
  select id as user_id
  from public.users
  where role = 'admin';

grant select on public.students, public.faculty, public.administrators to authenticated, service_role;

create view public.account_directory with (security_invoker = false) as
  select u.id, u.name, u.role, u.active,
    u.roll_no, u.program_code, u.department, u.year, u.section,
    u.is_hod,
    case when u.role = 'faculty' then u.department end as faculty_department
  from public.users u
  where (
    public.is_profile_admin() and u.role in ('admin', 'faculty')
  ) or (
    public.current_profile_role() = 'faculty'
    and (
      u.role = 'faculty'
      or (
        u.role = 'student'
        and (
          (
            public.is_hod()
            and public.is_current_hod_department(u.department, u.program_code)
          )
          or (
            not public.is_hod()
            and exists (
              select 1 from public.courses c
              where c.faculty_id = public.current_profile_id()
                and c.program_code = u.program_code and c.year = u.year
                and (nullif(c.section, '') is null or c.section = u.section)
            )
          )
        )
      )
    )
  );

grant select on public.account_directory to authenticated;

create or replace function public.register_student_from_auth()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  student_name text := trim(coalesce(new.raw_user_meta_data->>'name', ''));
  student_roll text := trim(coalesce(new.raw_user_meta_data->>'roll_no', ''));
  student_program text := lower(trim(coalesce(new.raw_user_meta_data->>'program_code', '')));
  student_department text := upper(trim(coalesce(new.raw_user_meta_data->>'department', '')));
  student_year text := trim(coalesce(new.raw_user_meta_data->>'year', ''));
  student_section text := upper(trim(coalesce(new.raw_user_meta_data->>'section', '')));
begin
  if new.raw_user_meta_data->>'registration_role' is distinct from 'student' then
    return new;
  end if;
  if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@gmail\.com$'
    or student_name = '' or student_roll = '' or student_program <> 'mca'
    or student_department <> 'MCA'
    or not ((student_section = 'AMCA' and student_year = '1') or (student_section = 'NMCA' and student_year = '2')) then
    raise exception 'MCA students must select AMCA (Year 1) or NMCA (Year 2) and provide all required details.';
  end if;
  insert into public.users (
    auth_user_id, name, email, role, roll_no, program_code, department, year, section, active, is_hod
  )
  values (
    new.id, student_name, lower(new.email), 'student', student_roll, 'mca', 'MCA',
    student_year, student_section, true, false
  );
  return new;
end;
$$;
