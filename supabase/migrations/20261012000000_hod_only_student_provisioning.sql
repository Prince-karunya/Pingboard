create or replace function public.register_student_from_auth()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'registration_role' = 'student' then
    raise exception 'Student accounts must be created by an authorized department HOD.';
  end if;
  return new;
end;
$$;

revoke all on function public.register_student_from_auth() from public, anon, authenticated;
grant execute on function public.register_student_from_auth() to service_role;
