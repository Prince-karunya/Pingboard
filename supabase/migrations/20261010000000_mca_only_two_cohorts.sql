update public.faculty
set department = 'MCA';

update public.users
set department = 'MCA'
where role in ('faculty', 'student');

update public.students
set department = 'MCA',
    program_code = 'mca',
    year = case when year = '1' or upper(program_code) = 'AMCA' then '1' else '2' end,
    section = case when year = '1' or upper(program_code) = 'AMCA' then 'AMCA' else 'NMCA' end;

update public.users u
set department = 'MCA',
    year = s.year,
    section = s.section
from public.students s
where s.user_id = u.id;

update public.courses
set department = 'MCA',
    program_code = 'mca',
    year = case when year = '1' or upper(coalesce(section, '')) = 'AMCA' then '1' else '2' end,
    section = case when year = '1' or upper(coalesce(section, '')) = 'AMCA' then 'AMCA' else 'NMCA' end;

update public.materials
set program_code = 'mca';

update public.notices n
set department = 'MCA',
    year = c.year,
    section = c.section
from public.courses c
where n.course_id = c.id;

update public.notices
set department = 'MCA',
    section = case when year = '1' then 'AMCA' when year = '2' then 'NMCA' else section end
where course_id is null and department is not null and department <> '';

alter table public.students
  add constraint students_mca_cohorts_only
  check (
    upper(department) = 'MCA'
    and lower(program_code) = 'mca'
    and ((section = 'AMCA' and year = '1') or (section = 'NMCA' and year = '2'))
  );

alter table public.faculty
  add constraint faculty_mca_only
  check (upper(department) = 'MCA');

alter table public.courses
  alter column section set not null;

alter table public.courses
  add constraint courses_mca_cohorts_only
  check (
    upper(department) = 'MCA'
    and lower(program_code) = 'mca'
    and ((section = 'AMCA' and year = '1') or (section = 'NMCA' and year = '2'))
  );

alter table public.users
  add constraint users_mca_department_only
  check (role not in ('faculty', 'student') or upper(department) = 'MCA');

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
  insert into public.users (auth_user_id, name, email, role, roll_no, department, year, section, active)
  values (new.id, student_name, lower(new.email), 'student', student_roll, 'MCA', student_year, student_section, true);
  insert into public.students (user_id, roll_no, program_code, department, year, section)
  select id, student_roll, 'mca', 'MCA', student_year, student_section
  from public.users where auth_user_id = new.id;
  return new;
end;
$$;

drop function public.get_course_student_emails(bigint, text);
create function public.get_course_student_emails(p_course_id bigint, p_year text)
returns table (
  name text,
  email text,
  roll_no text,
  department text,
  program_code text,
  year text,
  section text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  target_course public.courses%rowtype;
begin
  if not public.is_hod() then raise exception 'Department HOD access is required'; end if;
  select * into target_course from public.courses where id = p_course_id;
  if not found then raise exception 'Course not found'; end if;
  if not public.is_current_hod_department(target_course.department, target_course.program_code) then
    raise exception 'This course is outside your department';
  end if;
  if p_year is null or p_year = '' or p_year <> target_course.year then raise exception 'Select a valid course year'; end if;
  return query
    select u.name, u.email, s.roll_no, s.department, s.program_code, s.year, s.section
    from public.students s
    join public.users u on u.id = s.user_id
    where u.active and s.program_code = 'mca' and s.department = 'MCA'
      and s.year = p_year and s.section = target_course.section
    order by u.name;
end;
$$;

revoke all on function public.get_course_student_emails(bigint, text) from public, anon;
grant execute on function public.get_course_student_emails(bigint, text) to authenticated;
