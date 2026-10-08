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
          (
            public.is_hod()
            and public.is_current_hod_department(s.department, s.program_code)
          )
          or (
            not public.is_hod()
            and exists (
              select 1 from public.courses c
              where c.faculty_id = public.current_profile_id()
                and c.program_code = s.program_code and c.year = s.year
                and (nullif(c.section, '') is null or c.section = s.section)
            )
          )
        )
      )
    )
  );
