create or replace function public.current_hod_department()
returns text language sql stable security definer set search_path = public
as $$
  select lower(trim(f.department))
  from public.faculty f
  join public.users u on u.id = f.user_id
  where f.user_id = public.current_profile_id() and f.is_hod and u.active
  limit 1
$$;

create or replace function public.is_current_hod_department(target_department text, target_program text default null)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_hod()
    and nullif(public.current_hod_department(), '') is not null
    and (
      lower(trim(coalesce(target_department, ''))) = public.current_hod_department()
      or lower(trim(coalesce(target_program, ''))) = public.current_hod_department()
    )
$$;

create or replace function public.is_current_hod_student(target_user_id bigint)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.user_id = target_user_id
      and public.is_current_hod_department(s.department, s.program_code)
  )
$$;

revoke all on function public.current_hod_department() from public, anon;
revoke all on function public.is_current_hod_department(text, text) from public, anon;
revoke all on function public.is_current_hod_student(bigint) from public, anon;
grant execute on function public.current_hod_department() to authenticated, service_role;
grant execute on function public.is_current_hod_department(text, text) to authenticated, service_role;
grant execute on function public.is_current_hod_student(bigint) to authenticated, service_role;

drop policy if exists "users visible to self and admins" on public.users;
create policy "users visible to self staff admins and department HODs" on public.users
  for select to authenticated using (
    auth_user_id = auth.uid()
    or (public.is_profile_admin() and role in ('admin', 'faculty'))
    or (role = 'student' and public.is_current_hod_student(id))
  );
drop policy if exists "admins update users" on public.users;
create policy "admins update faculty and admin accounts" on public.users
  for update to authenticated using (public.is_profile_admin() and role in ('admin', 'faculty'))
  with check (public.is_profile_admin() and role in ('admin', 'faculty'));
revoke update on public.users from authenticated;
grant update (active, department) on public.users to authenticated;

drop policy if exists "students visible to self and admins" on public.students;
create policy "students visible to self and department HODs" on public.students
  for select to authenticated using (
    user_id = public.current_profile_id()
    or public.is_current_hod_student(user_id)
  );

drop policy if exists "read receipts visible to reader and notice staff" on public.read_receipts;
create policy "read receipts visible to reader notice owner and department HOD" on public.read_receipts
  for select to authenticated using (
    user_id = public.current_profile_id()
    or exists (
      select 1 from public.notices n
      left join public.courses c on c.id = n.course_id
      where n.id = notice_id and (
        n.created_by = public.current_profile_id()
        or public.is_current_hod_department(n.department, null)
        or (c.id is not null and public.is_current_hod_department(c.department, c.program_code))
      )
    )
  );

drop policy if exists "material views visible to reader and owner staff" on public.material_views;
create policy "material views visible to reader owner and department HOD" on public.material_views
  for select to authenticated using (
    user_id = public.current_profile_id()
    or exists (
      select 1 from public.materials m
      join public.courses c on c.id = m.course_id
      where m.id = material_id and (
        m.uploaded_by = public.current_profile_id()
        or public.is_current_hod_department(c.department, c.program_code)
      )
    )
  );

drop policy if exists "courses visible to assigned audience" on public.courses;
create policy "courses visible to assigned audience and department HOD" on public.courses
  for select to authenticated using (
    public.is_profile_admin()
    or public.is_current_hod_department(courses.department, courses.program_code)
    or faculty_id = public.current_profile_id()
    or exists (
      select 1 from public.students s
      where s.user_id = public.current_profile_id() and s.program_code = courses.program_code
        and s.year = courses.year and (nullif(courses.section, '') is null or s.section = courses.section)
    )
  );

drop policy if exists "materials visible to uploader admin or enrolled students" on public.materials;
drop policy if exists "materials visible to uploader admin HOD or enrolled students" on public.materials;
create policy "materials visible to uploader admin department HOD or enrolled students" on public.materials
  for select to authenticated using (
    public.is_profile_admin() or uploaded_by = public.current_profile_id()
    or exists (
      select 1 from public.courses c
      where c.id = course_id and public.is_current_hod_department(c.department, c.program_code)
    )
    or (
      visibility = 'published' and exists (
        select 1 from public.courses c join public.students s on s.user_id = public.current_profile_id()
        where c.id = course_id and c.program_code = s.program_code and c.year = s.year
          and (nullif(c.section, '') is null or c.section = s.section)
      )
    )
  );

create or replace view public.account_directory with (security_invoker = false) as
  select u.id, u.name, u.role, u.active,
    s.roll_no, s.program_code, s.department, s.year, s.section,
    f.is_hod, f.department as faculty_department
  from public.users u
  left join public.students s on s.user_id = u.id
  left join public.faculty f on f.user_id = u.id
  where (
    public.is_profile_admin() and u.role in ('admin', 'faculty')
  ) or (
    public.current_profile_role() = 'faculty'
    and (
      u.role = 'faculty'
      or (
        u.role = 'student'
        and (
          public.is_current_hod_department(s.department, s.program_code)
          or exists (
            select 1 from public.courses c
            where c.faculty_id = public.current_profile_id()
              and c.program_code = s.program_code and c.year = s.year
              and (nullif(c.section, '') is null or c.section = s.section)
          )
        )
      )
    )
  );

create or replace function public.get_hod_students()
returns table (
  user_id bigint,
  name text,
  email text,
  active boolean,
  roll_no text,
  program_code text,
  department text,
  year text,
  section text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_hod() then raise exception 'Department HOD access is required'; end if;
  return query
    select u.id, u.name, u.email, u.active, s.roll_no, s.program_code, s.department, s.year, s.section
    from public.students s
    join public.users u on u.id = s.user_id
    where public.is_current_hod_department(s.department, s.program_code)
    order by s.year, s.section, u.name;
end;
$$;

create or replace function public.get_course_student_emails(p_course_id bigint, p_year text)
returns table (name text, email text, roll_no text, program_code text, year text, section text)
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
    select u.name, u.email, s.roll_no, s.program_code, s.year, s.section
    from public.students s
    join public.users u on u.id = s.user_id
    where u.active and s.program_code = target_course.program_code and s.year = p_year
      and (nullif(target_course.section, '') is null or s.section = target_course.section)
    order by s.section, u.name;
end;
$$;

revoke all on function public.get_hod_students() from public, anon;
revoke all on function public.get_course_student_emails(bigint, text) from public, anon;
grant execute on function public.get_hod_students() to authenticated;
grant execute on function public.get_course_student_emails(bigint, text) to authenticated;
